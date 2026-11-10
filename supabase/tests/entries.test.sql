-- Run with `npx supabase test db`. Everything happens in one transaction and is rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(37);

-- A and B use the app; C, D and E only have entries made directly here, for the streak.
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@example.com'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@example.com'),
  ('cccccccc-0000-0000-0000-000000000003', 'c@example.com'),
  ('dddddddd-0000-0000-0000-000000000004', 'd@example.com'),
  ('eeeeeeee-0000-0000-0000-000000000005', 'e@example.com');
insert into public.profiles (id, display_name, native_language, learning_goal, timezone) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'A', 'Hindi', 'Work', 'Asia/Kolkata'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'B', 'Spanish', 'Travel', 'America/New_York'),
  ('cccccccc-0000-0000-0000-000000000003', 'C', 'Tamil', 'Work', 'Asia/Kolkata'),
  ('dddddddd-0000-0000-0000-000000000004', 'D', 'Tamil', 'Work', 'Asia/Kolkata'),
  ('eeeeeeee-0000-0000-0000-000000000005', 'E', 'Tamil', 'Work', 'Asia/Kolkata');

create temp table ids (name text primary key, id uuid not null);
grant all on ids to authenticated;

-- Journal days -------------------------------------------------------------------------------

select is(public.journal_date('2026-11-10 02:30+05:30', 'Asia/Kolkata'), '2026-11-09'::date, '2:30 AM still counts as the night before');
select is(public.journal_date('2026-11-10 04:30+05:30', 'Asia/Kolkata'), '2026-11-10'::date, 'after 4 AM it is the new day');
select is(public.journal_date('2026-11-10 02:30+05:30', 'America/New_York'), '2026-11-09'::date, 'the profile timezone decides the day');

select cmp_ok((select count(*) from public.prompts), '>=', 150::bigint, 'the prompt set is seeded');

-- Entries as A -------------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);

with x as (insert into public.entries (just_listen) values (false) returning id) insert into ids select 'a1', id from x;
with x as (insert into public.entries (just_listen) values (true) returning id) insert into ids select 'a2', id from x;

select results_eq(
  $$ select entry_number, status::text, local_date = public.user_today() from public.entries order by created_at $$,
  $$ values (null::int, 'uploading', true), (null::int, 'uploading', true) $$,
  'new entries start as uploading, unnumbered, on today''s journal date'
);

select throws_ok(
  $$ insert into public.entries (just_listen, status) values (false, 'ready') $$,
  '42501', null, 'the app cannot set an entry''s status'
);
select throws_ok(
  $$ insert into public.entries (just_listen, entry_number) values (false, 99) $$,
  '42501', null, 'the app cannot set an entry number'
);
select throws_ok(
  format($$ update public.entries set status = 'uploaded' where id = %L $$, (select id from ids where name = 'a1')),
  '42501', null, 'the app cannot update entries directly'
);

select throws_ok(
  format($$ insert into public.entry_pages (entry_id, page_index, storage_path) values (%L, 0, 'somewhere/else.jpg') $$, (select id from ids where name = 'a1')),
  '42501', null, 'a page row must point at {user}/{entry}/{index}.jpg'
);
select lives_ok(
  format($$ insert into public.entry_pages (entry_id, page_index, storage_path) values (%1$L, 0, 'aaaaaaaa-0000-0000-0000-000000000001/%1$s/0.jpg') $$, (select id from ids where name = 'a1')),
  'a page row for your own uploading entry is accepted'
);

select throws_ok(
  format($$ select public.complete_entry_upload(%L) $$, (select id from ids where name = 'a1')),
  'P0002', null, 'an entry can''t be completed before its photos are in storage'
);

-- Storage, as A.
select lives_ok(
  format($$ insert into storage.objects (bucket_id, name) values ('pages', 'aaaaaaaa-0000-0000-0000-000000000001/%s/0.jpg') $$, (select id from ids where name = 'a1')),
  'a user can upload a photo into their own uploading entry'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('pages', 'aaaaaaaa-0000-0000-0000-000000000001/not-an-entry/0.jpg') $$,
  '42501', null, 'photos must belong to one of the user''s entries'
);

select lives_ok(
  format($$ select public.complete_entry_upload(%L) $$, (select id from ids where name = 'a1')),
  'with every photo stored, the entry completes'
);
select is(
  (select status::text || ' #' || entry_number from public.entries where id = (select id from ids where name = 'a1')),
  'uploaded #1', 'the entry is now uploaded and numbered (a2, started earlier but unfinished, has no number)'
);
select lives_ok(
  format($$ select public.complete_entry_upload(%L) $$, (select id from ids where name = 'a1')),
  'completing again (a retry) is harmless'
);
select throws_ok(
  format($$ select public.complete_entry_upload(%L) $$, (select id from ids where name = 'a2')),
  'P0002', null, 'an entry with no pages can''t be completed'
);

select throws_ok(
  format($$ insert into public.entry_pages (entry_id, page_index, storage_path) values (%1$L, 1, 'aaaaaaaa-0000-0000-0000-000000000001/%1$s/1.jpg') $$, (select id from ids where name = 'a1')),
  '42501', null, 'pages can''t be added once an entry is uploaded'
);
select throws_ok(
  format($$ insert into storage.objects (bucket_id, name) values ('pages', 'aaaaaaaa-0000-0000-0000-000000000001/%s/1.jpg') $$, (select id from ids where name = 'a1')),
  '42501', null, 'photos can''t be added once an entry is uploaded'
);

select results_eq(
  $$ select entry_count, word_count, page_count from public.get_profile_stats() $$,
  $$ values (1, 0, 1) $$,
  'stats count uploaded entries and their pages only'
);

-- Prompts, as A.
create temp table prompt_ids (step text, id int);
grant all on prompt_ids to authenticated;
insert into prompt_ids select 'first', id from public.get_today_prompt();
insert into prompt_ids select 'again', id from public.get_today_prompt();
insert into prompt_ids select 'shuffled', id from public.shuffle_today_prompt();
insert into prompt_ids select 'after', id from public.get_today_prompt();

select is((select id from prompt_ids where step = 'again'), (select id from prompt_ids where step = 'first'), 'tonight''s prompt stays the same all day');
select isnt((select id from prompt_ids where step = 'shuffled'), (select id from prompt_ids where step = 'first'), 'shuffle picks a different prompt');
select is((select id from prompt_ids where step = 'after'), (select id from prompt_ids where step = 'shuffled'), 'the shuffled prompt sticks');
select throws_ok($$ insert into public.daily_prompts (user_id, local_date, prompt_id) values ('aaaaaaaa-0000-0000-0000-000000000001', current_date, 1) $$,
  '42501', null, 'daily prompts change only through the functions');

-- B can't see or touch A's things ------------------------------------------------------------

select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}', true);

select is((select count(*) from public.entries), 0::bigint, 'another user sees none of A''s entries');
select is((select count(*) from public.entry_pages), 0::bigint, 'another user sees none of A''s pages');
select is((select count(*) from storage.objects where bucket_id = 'pages'), 0::bigint, 'another user sees none of A''s photos');
select throws_ok(
  format($$ insert into storage.objects (bucket_id, name) values ('pages', 'aaaaaaaa-0000-0000-0000-000000000001/%s/1.jpg') $$, (select id from ids where name = 'a2')),
  '42501', null, 'another user can''t upload into A''s folder'
);
select throws_ok(
  format($$ select public.complete_entry_upload(%L) $$, (select id from ids where name = 'a2')),
  'P0002', null, 'another user can''t complete A''s entry'
);
select is((select count(*) from public.daily_prompts), 0::bigint, 'another user sees none of A''s prompts');

-- Signed out.
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$ select * from public.get_today_prompt() $$, '42501', null, 'signed-out clients get no prompt');
select throws_ok($$ select * from public.entries $$, '42501', null, 'signed-out clients can''t read entries');

-- Streaks ------------------------------------------------------------------------------------
-- Entries made directly, with created_at in the past; the trigger turns that into journal days.
reset role;

-- C: today, yesterday, 2 days ago, then a gap, then 4 days ago → 3 days, written today.
insert into public.entries (user_id, created_at, status)
select 'cccccccc-0000-0000-0000-000000000003', now() - make_interval(days => d), 'uploaded'
from unnest(array[0, 1, 2, 4]) as d;
-- An entry still uploading today doesn't count.
-- D: yesterday and 2 days ago (twice that day) → 2 days, not written today; today's upload is unfinished.
insert into public.entries (user_id, created_at, status)
select 'dddddddd-0000-0000-0000-000000000004', now() - make_interval(days => d), s::public.entry_status
from (values (1, 'uploaded'), (2, 'uploaded'), (2, 'failed'), (0, 'uploading')) as v(d, s);
-- E: last written 2 days ago → the streak is broken.
insert into public.entries (user_id, created_at, status)
values ('eeeeeeee-0000-0000-0000-000000000005', now() - interval '2 days', 'uploaded');

set local role authenticated;

select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated"}', true);
select results_eq(
  $$ select days, written_today, week[extract(isodow from today)::int] from public.get_streak() $$,
  $$ values (3, true, 'done') $$,
  'a gap ends the streak; today shows as done'
);

select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-000000000004","role":"authenticated"}', true);
select results_eq(
  $$ select days, written_today, week[extract(isodow from today)::int] from public.get_streak() $$,
  $$ values (2, false, 'today') $$,
  'a streak ending yesterday is still alive; unfinished uploads don''t count'
);

select set_config('request.jwt.claims', '{"sub":"eeeeeeee-0000-0000-0000-000000000005","role":"authenticated"}', true);
select is((select days from public.get_streak()), 0, 'missing yesterday resets the streak');
select is(
  (select week[extract(isodow from today)::int] from public.get_streak()),
  'today', 'the week runs Monday to Sunday with today in its place'
);

select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}', true);
select results_eq(
  $$ select days, written_today, array_length(week, 1) from public.get_streak() $$,
  $$ values (0, false, 7) $$,
  'someone with no entries has no streak and a 7-day week'
);

select * from finish();
rollback;
