-- Run with `npx supabase test db`. Everything happens in one transaction and is rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

insert into auth.users (id, email) values
  ('aaaaaaaa-1111-0000-0000-000000000001', 'coach-a@example.com'),
  ('bbbbbbbb-1111-0000-0000-000000000002', 'coach-b@example.com');
insert into public.profiles (id, display_name, native_language, learning_goal, persona, timezone) values
  ('aaaaaaaa-1111-0000-0000-000000000001', 'Asha', 'Hindi', 'Sound natural at work', 'friend', 'Asia/Kolkata'),
  ('bbbbbbbb-1111-0000-0000-000000000002', 'Ben', 'Spanish', 'Travel', 'cheerleader', 'Europe/Madrid');

-- A's entries: e1 uploaded today, e2 uploaded today, old one scored 8–13 days ago (for the delta).
insert into public.entries (id, user_id, status, created_at) values
  ('e1000000-0000-0000-0000-000000000001', 'aaaaaaaa-1111-0000-0000-000000000001', 'uploaded', now()),
  ('e2000000-0000-0000-0000-000000000002', 'aaaaaaaa-1111-0000-0000-000000000001', 'uploaded', now()),
  ('e0000000-0000-0000-0000-000000000000', 'aaaaaaaa-1111-0000-0000-000000000001', 'ready', now() - interval '9 days');
update public.entries set native_score = 60 where id = 'e0000000-0000-0000-0000-000000000000';
insert into public.mistakes (user_id, entry_id, error_type, original, corrected, created_at) values
  ('aaaaaaaa-1111-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000000', 'past_tense', 'I go', 'I went', now() - interval '9 days'),
  ('aaaaaaaa-1111-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000000', 'past_tense', 'I eat', 'I ate', now() - interval '2 days'),
  ('aaaaaaaa-1111-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000000', 'articles', 'go to office', 'go to the office', now() - interval '2 days');

select is((select count(*)::int from public.error_types), 27, 'the error-type taxonomy is seeded');

-- Claiming ------------------------------------------------------------------------------------

create temp table claim as select * from public.coach_claim('aaaaaaaa-1111-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', 'test/model');
select is((select status::text from public.entries where id = 'e1000000-0000-0000-0000-000000000001'), 'processing', 'claiming starts processing');
select is((select just_listen from claim), false, 'the claim says whether it is Just Listen');
select throws_ok(
  $$ select * from public.coach_claim('aaaaaaaa-1111-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', 'test/model') $$,
  'P0002', 'not_ready', 'an entry being processed can''t be claimed twice'
);
select throws_ok(
  $$ select * from public.coach_claim('bbbbbbbb-1111-0000-0000-000000000002', 'e2000000-0000-0000-0000-000000000002', 'test/model') $$,
  'P0002', 'not_ready', 'nobody can claim another user''s entry'
);

-- Context and history --------------------------------------------------------------------------

select is(
  (select public.coach_context('aaaaaaaa-1111-0000-0000-000000000001') -> 'recurring'),
  '[["Past tense", 2], ["Articles (a / the)", 1]]'::jsonb,
  'context lists recurring mistakes from the last 30 days, most frequent first'
);
select is(
  (select public.coach_context('aaaaaaaa-1111-0000-0000-000000000001') ->> 'persona'), 'friend', 'context carries the persona'
);
select results_eq(
  $$ select slug, total, this_week from public.coach_error_history('aaaaaaaa-1111-0000-0000-000000000001', array['past_tense', 'possessive']) $$,
  $$ values ('past_tense', 2, 1), ('possessive', 0, 0) $$,
  'error history: all-time and last-7-days counts per type'
);

-- Saving ------------------------------------------------------------------------------------------

select lives_ok($$
  select public.coach_save(
    (select run_id from claim),
    'e1000000-0000-0000-0000-000000000001',
    '{"transcript": "Today I eat rice. It was very very good.", "uncertain_words": [], "mood": "happy",
      "heavy": false, "safety_flag": false, "coach_persona": "friend", "coach_reply": "Rice again? Bold.",
      "native_version": "Today I ate rice. It was delicious.", "native_score": 72, "score_version": 1,
      "avg_sentence_len": 4.5, "word_count": 9, "coach_model": "test/model", "correct_patterns": ["articles"],
      "corrections": [{"kind": "grammar", "start": 6, "end": 11, "original": "I eat", "replacement": "I ate",
                       "error_type": "past_tense", "note_title": "Past tense", "note_body": "Past.", "tag": "Seen 2× this week"}],
      "mistakes": [{"error_type": "past_tense", "original": "I eat", "corrected": "I ate"}],
      "crutch": [{"word": "very", "count": 2, "alternatives": ["really"]}, {"word": "good", "count": 1, "alternatives": []}]}'::jsonb,
    '{"input_tokens": 1200, "output_tokens": 900, "cost_usd": 0, "latency_ms": 21000}'::jsonb
  )
$$, 'a finished run saves');

select results_eq(
  $$ select status::text, mood::text, word_count, native_score::int, score_delta::int, jsonb_array_length(corrections)
     from public.entries where id = 'e1000000-0000-0000-0000-000000000001' $$,
  $$ values ('ready', 'happy', 9, 72, 12, 1) $$,
  'the entry is ready, with its score and a delta against last week (72 − 60)'
);
select is((select count(*)::int from public.mistakes where entry_id = 'e1000000-0000-0000-0000-000000000001'), 1, 'grammar fixes are logged');
select is((select sum(count)::int from public.crutch_uses where entry_id = 'e1000000-0000-0000-0000-000000000001'), 3, 'crutch words are logged');
select is((select ok from public.coach_runs where id = (select run_id from claim)), true, 'the run is marked ok');

-- Failing -------------------------------------------------------------------------------------

create temp table claim2 as select * from public.coach_claim('aaaaaaaa-1111-0000-0000-000000000001', 'e2000000-0000-0000-0000-000000000002', 'test/model');
select public.coach_fail((select run_id from claim2), 'e2000000-0000-0000-0000-000000000002', 'provider timeout');
select is((select status::text from public.entries where id = 'e2000000-0000-0000-0000-000000000002'), 'failed', 'a failed run marks the entry failed');
select lives_ok(
  $$ select * from public.coach_claim('aaaaaaaa-1111-0000-0000-000000000001', 'e2000000-0000-0000-0000-000000000002', 'test/model') $$,
  'a failed entry can be tried again'
);

-- Daily cap: 5 good runs a day.
insert into public.coach_runs (user_id, local_date, model, ok)
select 'aaaaaaaa-1111-0000-0000-000000000001', public.journal_date(now(), 'Asia/Kolkata'), 'test/model', true from generate_series(1, 3);
update public.entries set status = 'failed' where id = 'e2000000-0000-0000-0000-000000000002';
select throws_ok(
  $$ select * from public.coach_claim('aaaaaaaa-1111-0000-0000-000000000001', 'e2000000-0000-0000-0000-000000000002', 'test/model') $$,
  'P0001', 'daily_limit', 'the sixth read of the day is refused'
);

-- What users can do ---------------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-1111-0000-0000-000000000001","role":"authenticated"}', true);

select is((select count(*)::int from public.mistakes), 4, 'a user reads their own mistakes');
select throws_ok(
  $$ insert into public.mistakes (user_id, entry_id, error_type, original, corrected) values ('aaaaaaaa-1111-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', 'other', 'x', 'y') $$,
  '42501', null, 'users can''t write mistakes'
);
select throws_ok(
  $$ select * from public.coach_claim('aaaaaaaa-1111-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', 'x') $$,
  '42501', null, 'users can''t call the coach''s functions'
);
select throws_ok($$ select * from public.coach_runs $$, '42501', null, 'users can''t read the run log');

select public.save_entry_to_vault('e1000000-0000-0000-0000-000000000001');
select isnt((select saved_at from public.entries where id = 'e1000000-0000-0000-0000-000000000001'), null, 'Save to my vault stamps the entry');

select public.switch_to_just_listen('e1000000-0000-0000-0000-000000000001');
select results_eq(
  $$ select just_listen, jsonb_array_length(corrections), native_score from public.entries where id = 'e1000000-0000-0000-0000-000000000001' $$,
  $$ values (true, 0, null::smallint) $$,
  'switching to Just Listen hides the feedback'
);
select is((select count(*)::int from public.mistakes where entry_id = 'e1000000-0000-0000-0000-000000000001'), 0, '…and forgets the logged mistakes');

select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-1111-0000-0000-000000000002","role":"authenticated"}', true);
select is((select count(*)::int from public.mistakes), 0, 'another user sees none of them');

select * from finish();
rollback;
