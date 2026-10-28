-- MessMantra update v2: adds the 'snacks' meal type and past history for the student History tab.
-- Run in Supabase -> SQL Editor (+ New query). Safe to run more than once.
-- Fresh install order: schema.sql -> sample_data.sql -> update_v2.sql
-- Existing database:  just run this file. No tables are added or removed.

-- 1) Allow 'snacks' as a meal type
alter table meals drop constraint if exists meals_type_check;
alter table meals add constraint meals_type_check check (type in ('breakfast','lunch','snacks','dinner'));

do $$
declare
  now_ms bigint := (extract(epoch from now()) * 1000)::bigint;
  mn constant bigint := 60000;
  hr constant bigint := 3600000;
  base bigint; ds bigint; d int; mid bigint;
  riya bigint; aarav bigint; staff_id bigint;
  bf text[] := array['Idli, sambar, coconut chutney','Poha, jalebi, chai','Aloo paratha, curd, pickle','Upma, banana, chai','Bread omelette, tea','Chole kulche, lassi'];
  ln text[] := array['Dal tadka, rice, roti, salad','Kadhi pakora, jeera rice, roti','Chole, rice, roti, raita','Mix veg, dal, rice, roti','Rajma, rice, roti, salad','Aloo gobhi, dal, rice, roti'];
  sn text[] := array['Samosa, green chutney, chai','Bread pakora, chai','Veg sandwich, juice','Maggi, chai','Pav bhaji, lemonade','Biscuits, chai'];
  dn text[] := array['Paneer masala, naan, rice, kheer','Egg curry, roti, rice','Dal makhani, roti, rice, gulab jamun','Veg biryani, raita, papad','Matar paneer, roti, rice','Kofta curry, roti, rice, halwa'];
begin
  -- 2) Reset the DEMO meal so it works again: it is now a snack, cutoff in 5 min
  update meals set type = 'snacks', menu = 'DEMO: Samosa, chutney, chai',
    cutoff_at = now_ms + 5*mn, serve_start = now_ms + 6*mn, serve_end = now_ms + 90*mn
  where menu like 'DEMO:%';

  if exists (select 1 from meals where menu = 'Idli, sambar, coconut chutney') then
    raise notice 'History sample already loaded.'; return;
  end if;

  select id into riya from users where email = 'student@mess.com';
  select id into aarav from users where email = 'aarav@mess.com';
  select id into staff_id from users where email = 'staff@mess.com';
  -- midnight today in India time (change the zone if you are elsewhere)
  base := (extract(epoch from (date_trunc('day', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata')) * 1000)::bigint;

  -- 3) Past 6 days of meals; Riya ate most of them (skipped: breakfast day 3, snacks day 3/5/6, dinner day 5)
  for d in 1..6 loop
    ds := base - d * 24 * hr;

    insert into meals (type, menu, cutoff_at, serve_start, serve_end, created_at)
      values ('breakfast', bf[d], ds + 360*mn, ds + 480*mn, ds + 570*mn, ds) returning id into mid;
    if d <> 3 then
      insert into optins (user_id, meal_id, status, updated_at) values (riya, mid, 'opted_in', ds + 300*mn);
      insert into ledger (user_id, meal_id, scanned_by, scanned_at) values (riya, mid, staff_id, ds + 490*mn);
    end if;

    insert into meals (type, menu, cutoff_at, serve_start, serve_end, created_at)
      values ('lunch', ln[d], ds + 600*mn, ds + 750*mn, ds + 870*mn, ds) returning id into mid;
    insert into optins (user_id, meal_id, status, updated_at) values (riya, mid, 'opted_in', ds + 540*mn);
    insert into ledger (user_id, meal_id, scanned_by, scanned_at) values (riya, mid, staff_id, ds + 760*mn);
    insert into optins (user_id, meal_id, status, updated_at) values (aarav, mid, 'opted_in', ds + 540*mn);
    insert into ledger (user_id, meal_id, scanned_by, scanned_at) values (aarav, mid, staff_id, ds + 770*mn);

    insert into meals (type, menu, cutoff_at, serve_start, serve_end, created_at)
      values ('snacks', sn[d], ds + 900*mn, ds + 990*mn, ds + 1050*mn, ds) returning id into mid;
    if d in (1, 2, 4) then
      insert into optins (user_id, meal_id, status, updated_at) values (riya, mid, 'opted_in', ds + 840*mn);
      insert into ledger (user_id, meal_id, scanned_by, scanned_at) values (riya, mid, staff_id, ds + 1000*mn);
    end if;

    insert into meals (type, menu, cutoff_at, serve_start, serve_end, created_at)
      values ('dinner', dn[d], ds + 1020*mn, ds + 1170*mn, ds + 1290*mn, ds) returning id into mid;
    if d <> 5 then
      insert into optins (user_id, meal_id, status, updated_at) values (riya, mid, 'opted_in', ds + 960*mn);
      insert into ledger (user_id, meal_id, scanned_by, scanned_at) values (riya, mid, staff_id, ds + 1180*mn);
    end if;
  end loop;

  raise notice 'History sample loaded.';
end $$;