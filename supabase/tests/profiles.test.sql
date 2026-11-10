-- Run with `npx supabase test db`. Everything happens in one transaction and is rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'b@example.com');

-- Act as user A.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select lives_ok(
  $$ insert into public.profiles (id, display_name, native_language, learning_goal, timezone)
     values ('11111111-1111-1111-1111-111111111111', 'Alice', 'Hindi', 'Sound natural at work', 'Asia/Kolkata') $$,
  'a user can create their own profile'
);

select throws_ok(
  $$ insert into public.profiles (id, display_name, native_language, learning_goal, timezone)
     values ('22222222-2222-2222-2222-222222222222', 'Mallory', 'Hindi', 'x', 'Asia/Kolkata') $$,
  '42501', null,
  'a user cannot create a profile for someone else'
);

select throws_ok(
  $$ update public.profiles set timezone = 'GMT+1' where id = '11111111-1111-1111-1111-111111111111' $$,
  '23514', null,
  'a timezone Postgres does not know is rejected'
);

select throws_ok(
  $$ update public.profiles set display_name = '   ' where id = '11111111-1111-1111-1111-111111111111' $$,
  '23514', null,
  'a blank name is rejected'
);

select throws_ok(
  $$ update public.profiles set created_at = now() - interval '1 year' $$,
  '42501', null,
  'timestamps are not writable by the user'
);

-- Act as user B.
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);

insert into public.profiles (id, display_name, native_language, learning_goal, timezone)
values ('22222222-2222-2222-2222-222222222222', 'Bob', 'Spanish', 'Travel', 'Europe/Madrid');

select results_eq(
  $$ select display_name from public.profiles $$,
  array['Bob'],
  'a user sees only their own profile'
);

update public.profiles set display_name = 'Hacked' where id = '11111111-1111-1111-1111-111111111111';

select lives_ok(
  $$ update public.profiles set persona = 'friend', nudge_time = '07:15' where id = '22222222-2222-2222-2222-222222222222' $$,
  'a user can change their own settings'
);

select throws_ok(
  $$ delete from public.profiles where id = '22222222-2222-2222-2222-222222222222' $$,
  '42501', null,
  'a user cannot delete their profile directly'
);

-- Signed out.
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select throws_ok(
  $$ select * from public.profiles $$,
  '42501', null,
  'signed-out clients cannot read profiles'
);

reset role;

select is(
  (select display_name from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'Alice',
  'another user''s update did not touch the profile'
);

select is(
  (select persona::text || ' ' || nudge_time::text from public.profiles where id = '22222222-2222-2222-2222-222222222222'),
  'friend 07:15:00',
  'own settings were saved'
);

delete from auth.users where id = '22222222-2222-2222-2222-222222222222';

select is(
  (select count(*) from public.profiles where id = '22222222-2222-2222-2222-222222222222'),
  0::bigint,
  'deleting the account deletes the profile'
);

select * from finish();
rollback;
