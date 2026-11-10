-- The AI coach: its results on entries, the error-type taxonomy, the writer's mistake log and
-- crutch words, and a run log for the daily cap. Only the process-entry function (service role)
-- writes these; users read their own.

create type public.mood as enum ('happy', 'grateful', 'calm', 'stressed');

alter table public.entries
  add column transcript text,
  add column uncertain_words text[] not null default '{}',
  add column mood public.mood,
  add column heavy boolean not null default false,
  add column safety_flag boolean not null default false,
  add column coach_persona public.persona, -- the voice that wrote the reply
  add column coach_reply text,
  add column native_version text,
  -- [{kind, start, end, original, replacement, error_type, note_title, note_body, tag}]; offsets index the transcript
  add column corrections jsonb not null default '[]'::jsonb,
  add column native_score smallint check (native_score between 0 and 100),
  add column score_version smallint,
  add column score_delta smallint, -- vs. the average of the writer's scores the week before
  add column avg_sentence_len real,
  add column correct_patterns text[] not null default '{}',
  add column coach_model text,
  add column coach_error text, -- why the last attempt failed; the app only reads the "no_handwriting" prefix
  add column processed_at timestamptz,
  add column saved_at timestamptz,
  add column search tsvector generated always as (to_tsvector('english', coalesce(transcript, ''))) stored;

create index entries_search_idx on public.entries using gin (search);

-- Error types -------------------------------------------------------------------------------
-- Same slugs as supabase/functions/_shared/coach/taxonomy.ts.

create table public.error_types (
  slug text primary key,
  name text not null
);

alter table public.error_types enable row level security;
create policy "Signed-in users read error types" on public.error_types for select to authenticated using (true);
revoke all on public.error_types from anon;
revoke insert, update, delete, truncate, references, trigger on public.error_types from authenticated;

insert into public.error_types (slug, name) values
  ('articles', 'Articles (a / the)'),
  ('past_tense', 'Past tense'),
  ('present_tense', 'Present tense'),
  ('future_forms', 'Future forms'),
  ('tense_consistency', 'Mixing tenses'),
  ('verb_form', 'Verb forms'),
  ('subject_verb_agreement', 'Subject–verb agreement'),
  ('prepositions', 'Prepositions (in / on / at)'),
  ('possessive', 'Possessive ’s'),
  ('plurals', 'Plurals'),
  ('countable_uncountable', 'Countable and uncountable'),
  ('pronouns', 'Pronouns'),
  ('word_order', 'Word order'),
  ('questions', 'Questions'),
  ('comparatives', 'Comparatives'),
  ('conditionals', 'Conditionals (if…)'),
  ('modal_verbs', 'Modal verbs'),
  ('gerund_infinitive', '-ing or to + verb'),
  ('missing_word', 'Missing words'),
  ('extra_word', 'Extra words'),
  ('spelling', 'Spelling'),
  ('punctuation', 'Punctuation'),
  ('sentence_structure', 'Sentence structure'),
  ('collocation', 'Word partners (collocations)'),
  ('word_choice', 'Word choice'),
  ('crutch_word', 'Crutch words'),
  ('other', 'Other');

-- The writer's history ------------------------------------------------------------------------

-- One row per grammar fix, for the tracker and the "Seen N× this week" tags.
create table public.mistakes (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  entry_id uuid not null references public.entries (id) on delete cascade,
  error_type text not null references public.error_types (slug),
  original text not null,
  corrected text not null,
  created_at timestamptz not null default now()
);
create index mistakes_user_type_idx on public.mistakes (user_id, error_type, created_at);
create index mistakes_entry_idx on public.mistakes (entry_id);

-- Crutch words per entry, for the vocabulary vault.
create table public.crutch_uses (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  entry_id uuid not null references public.entries (id) on delete cascade,
  word text not null,
  count int not null check (count > 0),
  alternatives text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index crutch_uses_user_idx on public.crutch_uses (user_id, created_at);
create index crutch_uses_entry_idx on public.crutch_uses (entry_id);

alter table public.mistakes enable row level security;
alter table public.crutch_uses enable row level security;
create policy "Users read their own mistakes" on public.mistakes for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users read their own crutch words" on public.crutch_uses for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.mistakes, public.crutch_uses from anon;
revoke insert, update, delete, truncate, references, trigger on public.mistakes, public.crutch_uses from authenticated;

-- Every coaching attempt: the daily cap, and what each run cost.
create table public.coach_runs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  entry_id uuid references public.entries (id) on delete set null,
  local_date date not null,
  model text not null,
  ok boolean, -- null while running
  error text,
  input_tokens int,
  output_tokens int,
  cost_usd numeric(10, 6),
  latency_ms int,
  created_at timestamptz not null default now()
);
create index coach_runs_user_day_idx on public.coach_runs (user_id, local_date);

alter table public.coach_runs enable row level security; -- no policies: service role only
revoke all on public.coach_runs from anon, authenticated;

-- For the process-entry function (service role only) ---------------------------------------

-- Per journal day: 5 successful reads, and 10 attempts in all.
create function public.coach_claim(p_user_id uuid, p_entry_id uuid, p_model text)
returns table (run_id bigint, just_listen boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  today date;
  ok_runs int;
  all_runs int;
  listen boolean;
  new_run bigint;
begin
  select public.journal_date(now(), p.timezone) into today from public.profiles p where p.id = p_user_id;
  if today is null then
    raise exception 'no_profile' using errcode = 'P0002';
  end if;

  select count(*) filter (where r.ok is not false), count(*) into ok_runs, all_runs
  from public.coach_runs r where r.user_id = p_user_id and r.local_date = today;
  if ok_runs >= 5 or all_runs >= 10 then
    raise exception 'daily_limit' using errcode = 'P0001';
  end if;

  -- Start coaching an uploaded or failed entry, or one stuck in processing for 5 minutes.
  update public.entries e set status = 'processing', coach_error = null
  where e.id = p_entry_id
    and e.user_id = p_user_id
    and (e.status in ('uploaded', 'failed') or (e.status = 'processing' and e.updated_at < now() - interval '5 minutes'))
  returning e.just_listen into listen;
  if not found then
    raise exception 'not_ready' using errcode = 'P0002';
  end if;

  insert into public.coach_runs (user_id, entry_id, local_date, model)
  values (p_user_id, p_entry_id, today, p_model)
  returning id into new_run;

  return query select new_run, listen;
end;
$$;

-- What the prompt needs to know about the writer.
create function public.coach_context(p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'name', p.display_name,
    'native_language', p.native_language,
    'learning_goal', p.learning_goal,
    'persona', p.persona,
    'recurring', coalesce((
      select jsonb_agg(jsonb_build_array(t.name, x.n) order by x.n desc)
      from (
        select m.error_type, count(*) as n from public.mistakes m
        where m.user_id = p_user_id and m.created_at > now() - interval '30 days'
        group by m.error_type order by n desc limit 5
      ) x join public.error_types t on t.slug = x.error_type
    ), '[]'::jsonb),
    'crutch_words', coalesce((
      select jsonb_agg(jsonb_build_array(x.word, x.n) order by x.n desc)
      from (
        select c.word, sum(c.count)::int as n from public.crutch_uses c
        where c.user_id = p_user_id and c.created_at > now() - interval '30 days'
        group by c.word order by n desc limit 5
      ) x
    ), '[]'::jsonb)
  )
  from public.profiles p where p.id = p_user_id;
$$;

-- For the note tags: how often each error type was seen before this entry.
create function public.coach_error_history(p_user_id uuid, p_slugs text[])
returns table (slug text, total int, this_week int)
language sql
stable
security definer
set search_path = ''
as $$
  select s.slug,
    (select count(*)::int from public.mistakes m where m.user_id = p_user_id and m.error_type = s.slug),
    (select count(*)::int from public.mistakes m where m.user_id = p_user_id and m.error_type = s.slug and m.created_at > now() - interval '7 days')
  from unnest(p_slugs) as s(slug);
$$;

-- Saves a finished coaching run in one transaction. p_result holds the entry fields plus
-- "mistakes" [{error_type, original, corrected}] and "crutch" [{word, count, alternatives}].
create function public.coach_save(p_run_id bigint, p_entry_id uuid, p_result jsonb, p_usage jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.entries;
  last_week numeric;
begin
  select * into e from public.entries where id = p_entry_id for update;

  if (p_result->>'native_score') is not null then
    select avg(x.native_score) into last_week from public.entries x
    where x.user_id = e.user_id and x.id <> e.id and x.status = 'ready' and x.native_score is not null
      and x.local_date between e.local_date - 13 and e.local_date - 7;
  end if;

  update public.entries set
    status = 'ready',
    transcript = p_result->>'transcript',
    uncertain_words = array(select jsonb_array_elements_text(coalesce(p_result->'uncertain_words', '[]'))),
    mood = (p_result->>'mood')::public.mood,
    heavy = coalesce((p_result->>'heavy')::boolean, false),
    safety_flag = coalesce((p_result->>'safety_flag')::boolean, false),
    coach_persona = (p_result->>'coach_persona')::public.persona,
    coach_reply = p_result->>'coach_reply',
    native_version = p_result->>'native_version',
    corrections = coalesce(p_result->'corrections', '[]'),
    native_score = (p_result->>'native_score')::smallint,
    score_version = (p_result->>'score_version')::smallint,
    score_delta = case when last_week is null then null else round((p_result->>'native_score')::numeric - last_week)::smallint end,
    avg_sentence_len = (p_result->>'avg_sentence_len')::real,
    correct_patterns = array(select jsonb_array_elements_text(coalesce(p_result->'correct_patterns', '[]'))),
    word_count = (p_result->>'word_count')::int,
    coach_model = p_result->>'coach_model',
    coach_error = null,
    processed_at = now()
  where id = p_entry_id;

  -- A re-run replaces what the last run logged.
  delete from public.mistakes where entry_id = p_entry_id;
  insert into public.mistakes (user_id, entry_id, error_type, original, corrected)
  select e.user_id, p_entry_id, m->>'error_type', m->>'original', m->>'corrected'
  from jsonb_array_elements(coalesce(p_result->'mistakes', '[]')) m;

  delete from public.crutch_uses where entry_id = p_entry_id;
  insert into public.crutch_uses (user_id, entry_id, word, count, alternatives)
  select e.user_id, p_entry_id, c->>'word', (c->>'count')::int, array(select jsonb_array_elements_text(coalesce(c->'alternatives', '[]')))
  from jsonb_array_elements(coalesce(p_result->'crutch', '[]')) c;

  update public.coach_runs set
    ok = true,
    input_tokens = (p_usage->>'input_tokens')::int,
    output_tokens = (p_usage->>'output_tokens')::int,
    cost_usd = (p_usage->>'cost_usd')::numeric,
    latency_ms = (p_usage->>'latency_ms')::int
  where id = p_run_id;
end;
$$;

create function public.coach_fail(p_run_id bigint, p_entry_id uuid, p_error text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.entries set status = 'failed', coach_error = left(p_error, 1000) where id = p_entry_id and status = 'processing';
  update public.coach_runs set ok = false, error = left(p_error, 1000) where id = p_run_id;
$$;

revoke execute on function public.coach_claim(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.coach_context(uuid) from public, anon, authenticated;
revoke execute on function public.coach_error_history(uuid, text[]) from public, anon, authenticated;
revoke execute on function public.coach_save(bigint, uuid, jsonb, jsonb) from public, anon, authenticated;
revoke execute on function public.coach_fail(bigint, uuid, text) from public, anon, authenticated;
grant execute on function public.coach_claim(uuid, uuid, text) to service_role;
grant execute on function public.coach_context(uuid) to service_role;
grant execute on function public.coach_error_history(uuid, text[]) to service_role;
grant execute on function public.coach_save(bigint, uuid, jsonb, jsonb) to service_role;
grant execute on function public.coach_fail(bigint, uuid, text) to service_role;

-- For the app ---------------------------------------------------------------------------------

-- "Save to my vault".
create function public.save_entry_to_vault(p_entry_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.entries set saved_at = coalesce(saved_at, now())
  where id = p_entry_id and user_id = auth.uid() and status = 'ready';
$$;

-- Accepting the "feels heavy, want me to just listen?" offer: hide the feedback and forget the
-- mistakes and crutch words this entry logged.
create function public.switch_to_just_listen(p_entry_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.entries set
    just_listen = true,
    corrections = '[]',
    native_version = null,
    native_score = null,
    score_delta = null,
    correct_patterns = '{}'
  where id = p_entry_id and user_id = auth.uid() and status = 'ready' and not just_listen;
  if not found then return; end if;
  delete from public.mistakes where entry_id = p_entry_id;
  delete from public.crutch_uses where entry_id = p_entry_id;
end;
$$;

revoke execute on function public.save_entry_to_vault(uuid) from public, anon;
revoke execute on function public.switch_to_just_listen(uuid) from public, anon;
grant execute on function public.save_entry_to_vault(uuid) to authenticated;
grant execute on function public.switch_to_just_listen(uuid) to authenticated;
