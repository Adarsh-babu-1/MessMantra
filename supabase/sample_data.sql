-- MessMantra sample data. Run AFTER schema.sql: Supabase -> SQL Editor -> paste -> Run.
-- All times are relative to the moment you run it, so run it shortly before your demo.
--
-- To start over, run this first, then run the file again (users are kept):
--   truncate ledger, qr_tokens, optins, audit, meals restart identity cascade;
--
-- Logins (passwords are bcrypt-hashed by the database):
--   admin@mess.com / admin12345      staff@mess.com / staff12345
--   student@mess.com (Riya) / student12345
--   aarav@, priya@, rohan@, sneha@, vikram@, ananya@, karan@  (all @mess.com) / student12345

create extension if not exists pgcrypto with schema extensions;

do $$
declare
  now_ms bigint := (extract(epoch from now()) * 1000)::bigint;
  mn constant bigint := 60000;
  hr constant bigint := 3600000;
  staff_id bigint; admin_id bigint;
  m_bf bigint; m_lunch bigint; m_demo bigint; m_dinner bigint; m_tbf bigint;
begin
  if exists (select 1 from meals where menu = 'Aloo paratha, curd, pickle, tea') then
    raise notice 'Sample data already loaded. Run the truncate line at the top first to reload.';
    return;
  end if;

  -- Users (the database hashes the passwords with bcrypt, compatible with bcryptjs)
  insert into users (name, email, password_hash, role, created_at) values
    ('Admin',         'admin@mess.com',   extensions.crypt('admin12345',   extensions.gen_salt('bf', 10)), 'admin',   now_ms),
    ('Kitchen Staff', 'staff@mess.com',   extensions.crypt('staff12345',   extensions.gen_salt('bf', 10)), 'staff',   now_ms),
    ('Riya Sharma',   'student@mess.com', extensions.crypt('student12345', extensions.gen_salt('bf', 10)), 'student', now_ms),
    ('Aarav Singh',   'aarav@mess.com',   extensions.crypt('student12345', extensions.gen_salt('bf', 10)), 'student', now_ms),
    ('Priya Verma',   'priya@mess.com',   extensions.crypt('student12345', extensions.gen_salt('bf', 10)), 'student', now_ms),
    ('Rohan Gupta',   'rohan@mess.com',   extensions.crypt('student12345', extensions.gen_salt('bf', 10)), 'student', now_ms),
    ('Sneha Yadav',   'sneha@mess.com',   extensions.crypt('student12345', extensions.gen_salt('bf', 10)), 'student', now_ms),
    ('Vikram Mishra', 'vikram@mess.com',  extensions.crypt('student12345', extensions.gen_salt('bf', 10)), 'student', now_ms),
    ('Ananya Tiwari', 'ananya@mess.com',  extensions.crypt('student12345', extensions.gen_salt('bf', 10)), 'student', now_ms),
    ('Karan Patel',   'karan@mess.com',   extensions.crypt('student12345', extensions.gen_salt('bf', 10)), 'student', now_ms)
  on conflict (email) do nothing;
  select id into admin_id from users where email = 'admin@mess.com';
  select id into staff_id from users where email = 'staff@mess.com';

  -- Meals: finished breakfast, lunch being served NOW, a DEMO snacks meal whose cutoff is in 3 min, dinner later, tomorrow breakfast
  insert into meals (type, menu, cutoff_at, serve_start, serve_end, created_at)
    values ('breakfast', 'Aloo paratha, curd, pickle, tea', now_ms - 10*hr, now_ms - 8*hr, now_ms - 6*hr, now_ms - 24*hr) returning id into m_bf;
  insert into meals (type, menu, cutoff_at, serve_start, serve_end, created_at)
    values ('lunch', 'Rajma, jeera rice, roti, salad', now_ms - 30*mn, now_ms - 10*mn, now_ms + 110*mn, now_ms - 24*hr) returning id into m_lunch;
  insert into meals (type, menu, cutoff_at, serve_start, serve_end, created_at)
    values ('snacks', 'DEMO: Samosa, chutney, chai', now_ms + 3*mn, now_ms + 4*mn, now_ms + 90*mn, now_ms) returning id into m_demo;
  insert into meals (type, menu, cutoff_at, serve_start, serve_end, created_at)
    values ('dinner', 'Paneer butter masala, naan, rice, kheer', now_ms + 3*hr, now_ms + 5*hr, now_ms + 7*hr, now_ms) returning id into m_dinner;
  insert into meals (type, menu, cutoff_at, serve_start, serve_end, created_at)
    values ('breakfast', 'Poha, jalebi, banana, chai', now_ms + 20*hr, now_ms + 24*hr, now_ms + 26*hr, now_ms) returning id into m_tbf;

  -- Opt-ins
  insert into optins (user_id, meal_id, status, updated_at)
    select id, m_bf, 'opted_in', now_ms - 12*hr from users where email in
      ('aarav@mess.com','priya@mess.com','rohan@mess.com','sneha@mess.com','vikram@mess.com','ananya@mess.com');
  insert into optins (user_id, meal_id, status, updated_at)
    select id, m_lunch, 'opted_in', now_ms - 3*hr from users where email in
      ('student@mess.com','aarav@mess.com','priya@mess.com','rohan@mess.com','sneha@mess.com');
  insert into optins (user_id, meal_id, status, updated_at)
    select id, m_lunch, 'cancelled', now_ms - 2*hr from users where email in ('vikram@mess.com','ananya@mess.com');
  insert into optins (user_id, meal_id, status, updated_at)
    select id, m_demo, 'opted_in', now_ms - 10*mn from users where email in ('aarav@mess.com','priya@mess.com');
  insert into optins (user_id, meal_id, status, updated_at)
    select id, m_dinner, 'opted_in', now_ms - 20*mn from users where email in
      ('aarav@mess.com','priya@mess.com','rohan@mess.com','karan@mess.com');
  insert into optins (user_id, meal_id, status, updated_at)
    select id, m_tbf, 'opted_in', now_ms - 5*mn from users where email = 'sneha@mess.com';

  -- Ledger: 5 of 6 ate breakfast (Vikram did not turn up = wasted plate), 2 already ate lunch.
  -- Riya and Rohan can still be scanned for lunch in the live demo.
  insert into ledger (user_id, meal_id, scanned_by, scanned_at)
    select id, m_bf, staff_id, now_ms - 7*hr + row_number() over (order by id) * 3*mn from users
    where email in ('aarav@mess.com','priya@mess.com','rohan@mess.com','sneha@mess.com','ananya@mess.com');
  insert into ledger (user_id, meal_id, scanned_by, scanned_at)
    select id, m_lunch, staff_id, now_ms - 8*mn + row_number() over (order by id) * mn from users
    where email in ('aarav@mess.com','priya@mess.com');

  -- Audit trail
  insert into audit (actor_id, action, details, created_at) values
    (admin_id, 'login', 'admin', now_ms - 25*hr),
    (admin_id, 'meal_created', 'breakfast: Aloo paratha, curd, pickle, tea', now_ms - 24*hr),
    (admin_id, 'meal_created', 'lunch: Rajma, jeera rice, roti, salad', now_ms - 24*hr + mn),
    (admin_id, 'meal_created', 'snacks: DEMO: Samosa, chutney, chai', now_ms - 5*mn),
    (admin_id, 'meal_created', 'dinner: Paneer butter masala, naan, rice, kheer', now_ms - 4*mn),
    (admin_id, 'meal_created', 'breakfast: Poha, jalebi, banana, chai', now_ms - 3*mn);
  insert into audit (actor_id, action, details, created_at)
    select o.user_id, o.status, m.type, o.updated_at from optins o join meals m on m.id = o.meal_id;
  insert into audit (actor_id, action, details, created_at)
    select l.scanned_by, 'scan_ok', u.name || ' / ' || m.type, l.scanned_at
    from ledger l join users u on u.id = l.user_id join meals m on m.id = l.meal_id;
  insert into audit (actor_id, action, details, created_at) values
    (staff_id, 'scan_rejected', 'QR already used or replaced', now_ms - 7*mn),
    ((select id from users where email = 'vikram@mess.com'), 'rejected_after_cutoff', 'lunch opted_in', now_ms - 20*mn);

  raise notice 'Sample data loaded.';
end $$;