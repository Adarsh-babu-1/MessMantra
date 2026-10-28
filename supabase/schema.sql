-- MessMantra schema for Supabase (PostgreSQL).
-- Run this whole file once: Supabase dashboard -> SQL Editor -> New query -> paste -> Run.
-- All times are epoch milliseconds from the SERVER clock.

create table if not exists users (
  id bigint generated always as identity primary key,
  name text not null,
  email text not null unique,
  password_hash text not null,
  role text not null check (role in ('student','staff','admin')),
  created_at bigint not null
);
create table if not exists meals (
  id bigint generated always as identity primary key,
  type text not null check (type in ('breakfast','lunch','snacks','dinner')),
  menu text not null,
  cutoff_at bigint not null,
  serve_start bigint not null,
  serve_end bigint not null,
  created_at bigint not null
);
create table if not exists optins (
  id bigint generated always as identity primary key,
  user_id bigint not null references users(id),
  meal_id bigint not null references meals(id),
  status text not null check (status in ('opted_in','cancelled')),
  updated_at bigint not null,
  unique (user_id, meal_id)
);
create table if not exists qr_tokens (
  nonce text primary key,
  user_id bigint not null references users(id),
  meal_id bigint not null references meals(id),
  expires_at bigint not null,
  used_at bigint,
  used_by bigint references users(id)
);
create table if not exists ledger (
  id bigint generated always as identity primary key,
  user_id bigint not null references users(id),
  meal_id bigint not null references meals(id),
  scanned_by bigint not null references users(id),
  scanned_at bigint not null,
  unique (user_id, meal_id)
);
create table if not exists audit (
  id bigint generated always as identity primary key,
  actor_id bigint,
  action text not null,
  details text,
  created_at bigint not null
);
create index if not exists idx_optins_meal on optins (meal_id, status);
create index if not exists idx_tokens_user_meal on qr_tokens (user_id, meal_id);
create index if not exists idx_ledger_meal on ledger (meal_id);
create index if not exists idx_audit_time on audit (created_at);

-- Lock the tables: with RLS on and no policies, the public anon key can read nothing.
-- Only our Express server (service_role key) can touch the data.
alter table users enable row level security;
alter table meals enable row level security;
alter table optins enable row level security;
alter table qr_tokens enable row level security;
alter table ledger enable row level security;
alter table audit enable row level security;

-- Opt in / cancel. The cutoff check is inside the SQL (cutoff_at > now), so it cannot be bypassed.
create or replace function set_optin(p_user bigint, p_meal bigint, p_status text, p_now bigint)
returns text language plpgsql as $$
declare v_type text; n int;
begin
  select m.type into v_type from meals m where m.id = p_meal;
  if v_type is null then return 'not_found'; end if;
  insert into optins (user_id, meal_id, status, updated_at)
    select p_user, m.id, p_status, p_now from meals m where m.id = p_meal and m.cutoff_at > p_now
  on conflict (user_id, meal_id) do update set status = excluded.status, updated_at = excluded.updated_at;
  get diagnostics n = row_count;
  if n = 0 then
    insert into audit (actor_id, action, details, created_at) values (p_user, 'rejected_after_cutoff', v_type || ' ' || p_status, p_now);
    return 'cutoff';
  end if;
  insert into audit (actor_id, action, details, created_at) values (p_user, p_status, v_type, p_now);
  return 'ok';
end $$;

-- Store a new QR token (the Node server signs it). A new code replaces older unused ones.
create or replace function issue_qr(p_user bigint, p_meal bigint, p_nonce text, p_exp bigint, p_now bigint)
returns jsonb language plpgsql as $$
declare m meals%rowtype; o text;
begin
  select * into m from meals where id = p_meal;
  if not found then return jsonb_build_object('ok', false, 'code', 404, 'error', 'Meal not found'); end if;
  select status into o from optins where user_id = p_user and meal_id = p_meal;
  if o is distinct from 'opted_in' then return jsonb_build_object('ok', false, 'code', 403, 'error', 'Opt in to this meal first'); end if;
  if p_now > m.serve_end then return jsonb_build_object('ok', false, 'code', 410, 'error', 'This meal has ended'); end if;
  if exists (select 1 from ledger where user_id = p_user and meal_id = p_meal) then
    return jsonb_build_object('ok', false, 'code', 409, 'error', 'Meal already taken');
  end if;
  delete from qr_tokens where user_id = p_user and meal_id = p_meal and used_at is null;
  insert into qr_tokens (nonce, user_id, meal_id, expires_at) values (p_nonce, p_user, p_meal, p_exp);
  delete from qr_tokens where used_at is null and expires_at < p_now - 300000;
  return jsonb_build_object('ok', true);
end $$;

-- Redeem a QR. One function call = one transaction, so only one scan can ever win.
create or replace function redeem_qr(p_user bigint, p_meal bigint, p_nonce text, p_staff bigint, p_now bigint)
returns jsonb language plpgsql as $$
declare m meals%rowtype; o text; sname text; n int;
begin
  select * into m from meals where id = p_meal;
  if not found then return jsonb_build_object('ok', false, 'reason', 'Meal not found'); end if;
  if p_now < m.serve_start or p_now > m.serve_end then
    return jsonb_build_object('ok', false, 'reason', 'Meal is not being served right now');
  end if;
  select status into o from optins where user_id = p_user and meal_id = p_meal;
  if o is distinct from 'opted_in' then return jsonb_build_object('ok', false, 'reason', 'Student is not opted in'); end if;
  begin
    -- THE atomic step: a second scan waits on the row lock, then finds used_at no longer null.
    update qr_tokens set used_at = p_now, used_by = p_staff
      where nonce = p_nonce and user_id = p_user and meal_id = p_meal and used_at is null and expires_at > p_now;
    if not found then return jsonb_build_object('ok', false, 'reason', 'QR already used or replaced'); end if;
    insert into ledger (user_id, meal_id, scanned_by, scanned_at) values (p_user, p_meal, p_staff, p_now)
      on conflict (user_id, meal_id) do nothing;
    get diagnostics n = row_count;
    if n = 0 then raise exception 'meal_taken'; end if; -- rolls back the used_at update too
  exception when raise_exception then
    return jsonb_build_object('ok', false, 'reason', 'Meal already taken');
  end;
  select name into sname from users where id = p_user;
  insert into audit (actor_id, action, details, created_at) values (p_staff, 'scan_ok', sname || ' / ' || m.type, p_now);
  return jsonb_build_object('ok', true, 'student', sname, 'meal', m.type, 'menu', m.menu);
end $$;

create or replace function forecast_meals(p_since bigint)
returns table (id bigint, type text, menu text, cutoff_at bigint, serve_start bigint, serve_end bigint, projected bigint, consumed bigint)
language sql stable as $$
  select m.id, m.type, m.menu, m.cutoff_at, m.serve_start, m.serve_end,
    (select count(*) from optins o where o.meal_id = m.id and o.status = 'opted_in'),
    (select count(*) from ledger l where l.meal_id = m.id)
  from meals m where m.serve_end > p_since order by m.serve_start
$$;

create or replace function admin_ledger()
returns table (scanned_at bigint, student text, meal text, menu text, staff text)
language sql stable as $$
  select l.scanned_at, u.name, m.type, m.menu, s.name
  from ledger l join users u on u.id = l.user_id join meals m on m.id = l.meal_id join users s on s.id = l.scanned_by
  order by l.id desc limit 500
$$;

create or replace function admin_audit()
returns table (created_at bigint, actor text, action text, details text)
language sql stable as $$
  select a.created_at, coalesce(u.name, 'anonymous'), a.action, a.details
  from audit a left join users u on u.id = a.actor_id order by a.id desc limit 300
$$;

-- These functions are for the server only, hide them from the public API.
revoke execute on function set_optin(bigint, bigint, text, bigint) from public, anon, authenticated;
revoke execute on function issue_qr(bigint, bigint, text, bigint, bigint) from public, anon, authenticated;
revoke execute on function redeem_qr(bigint, bigint, text, bigint, bigint) from public, anon, authenticated;
revoke execute on function forecast_meals(bigint) from public, anon, authenticated;
revoke execute on function admin_ledger() from public, anon, authenticated;
revoke execute on function admin_audit() from public, anon, authenticated;