-- Entries (one per scan), their page photos, nightly prompts and the streak.
-- The AI coach (Phase 4) adds its result columns to entries in its own migration.

-- A journal day runs 4 AM to 4 AM in the writer's timezone, so late-night writing counts for
-- that night.
create function public.journal_date(at timestamptz, tz text)
returns date
language sql
stable
set search_path = ''
as $$
  select ((at at time zone tz) - interval '4 hours')::date;
$$;

-- Today's journal date for the signed-in user, or null without a profile.
create function public.user_today()
returns date
language sql
stable
set search_path = ''
as $$
  select public.journal_date(now(), p.timezone) from public.profiles p where p.id = (select auth.uid());
$$;

-- Prompts ------------------------------------------------------------------------------------

create table public.prompts (
  id int generated always as identity primary key,
  text text not null unique check (char_length(text) between 10 and 160)
);

alter table public.prompts enable row level security;

create policy "Signed-in users read prompts"
  on public.prompts for select to authenticated
  using (true);

revoke all on public.prompts from anon;
revoke insert, update, delete, truncate, references, trigger on public.prompts from authenticated;

-- One prompt per user per journal day, assigned lazily by get_today_prompt().
create table public.daily_prompts (
  user_id uuid not null references auth.users (id) on delete cascade,
  local_date date not null,
  prompt_id int not null references public.prompts (id),
  primary key (user_id, local_date)
);

alter table public.daily_prompts enable row level security;

create policy "Users read their own daily prompts"
  on public.daily_prompts for select to authenticated
  using ((select auth.uid()) = user_id);

-- Written only through the functions below.
revoke all on public.daily_prompts from anon;
revoke insert, update, delete, truncate, references, trigger on public.daily_prompts from authenticated;

-- A random prompt this user hasn't been given in the last 90 days (any prompt once they've
-- seen them all), never `not_this`.
create function public.pick_prompt(uid uuid, not_this int)
returns int
language sql
volatile
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.id from public.prompts p
      where p.id is distinct from not_this
        and not exists (
          select 1 from public.daily_prompts dp
          where dp.user_id = uid and dp.prompt_id = p.id and dp.local_date > current_date - 90)
      order by random() limit 1),
    (select p.id from public.prompts p where p.id is distinct from not_this order by random() limit 1)
  );
$$;

revoke execute on function public.pick_prompt(uuid, int) from public, anon, authenticated;

-- Tonight's prompt: the same one all day, until shuffled.
create function public.get_today_prompt()
returns table (id int, text text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  today date := public.user_today();
  chosen int;
begin
  if uid is null or today is null then
    raise exception 'Sign in and finish onboarding first' using errcode = '42501';
  end if;

  select dp.prompt_id into chosen from public.daily_prompts dp where dp.user_id = uid and dp.local_date = today;
  if chosen is null then
    insert into public.daily_prompts (user_id, local_date, prompt_id)
    values (uid, today, public.pick_prompt(uid, null))
    on conflict (user_id, local_date) do nothing;
    -- Re-read, so two simultaneous first calls agree on the same prompt.
    select dp.prompt_id into chosen from public.daily_prompts dp where dp.user_id = uid and dp.local_date = today;
  end if;

  return query select p.id, p.text from public.prompts p where p.id = chosen;
end;
$$;

create function public.shuffle_today_prompt()
returns table (id int, text text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  today date := public.user_today();
  current_id int;
  chosen int;
begin
  select t.id into current_id from public.get_today_prompt() t;
  chosen := public.pick_prompt(uid, current_id);
  update public.daily_prompts dp set prompt_id = chosen where dp.user_id = uid and dp.local_date = today;
  return query select p.id, p.text from public.prompts p where p.id = chosen;
end;
$$;

revoke execute on function public.get_today_prompt() from public, anon;
revoke execute on function public.shuffle_today_prompt() from public, anon;
grant execute on function public.get_today_prompt() to authenticated;
grant execute on function public.shuffle_today_prompt() to authenticated;

-- Entries ------------------------------------------------------------------------------------

-- uploading: created, pages still going up (doesn't count yet)
-- uploaded:  all pages stored; counts for the streak from here on, even if coaching fails
-- processing / ready / failed: the AI coach (Phase 4)
create type public.entry_status as enum ('uploading', 'uploaded', 'processing', 'ready', 'failed');

create table public.entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- 1, 2, 3… per user, given when the upload completes, so abandoned uploads leave no gaps.
  entry_number int,
  -- Always replaced by the trigger with journal_date(created_at, profile timezone). The default
  -- only keeps clients from having to send it.
  local_date date not null default current_date,
  prompt_id int references public.prompts (id) on delete set null,
  status public.entry_status not null default 'uploading',
  just_listen boolean not null default false,
  word_count int check (word_count >= 0), -- filled in by the coach
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, entry_number)
);

create index entries_user_created_idx on public.entries (user_id, created_at desc);
create index entries_user_date_idx on public.entries (user_id, local_date);

create function public.entries_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  tz text;
begin
  select p.timezone into tz from public.profiles p where p.id = new.user_id;
  if tz is null then
    raise exception 'Finish onboarding before adding entries' using errcode = '23503';
  end if;
  new.local_date := public.journal_date(new.created_at, tz);
  return new;
end;
$$;

create trigger entries_before_insert
  before insert on public.entries
  for each row execute function public.entries_before_insert();

create trigger entries_set_updated_at
  before update on public.entries
  for each row execute function public.set_updated_at();

alter table public.entries enable row level security;

create policy "Users read their own entries"
  on public.entries for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users create their own entries"
  on public.entries for insert to authenticated
  with check ((select auth.uid()) = user_id);

-- The app only chooses the prompt and Just Listen. Status moves through
-- complete_entry_upload() and, later, the coach.
revoke all on public.entries from anon;
revoke insert, update, delete, truncate, references, trigger on public.entries from authenticated;
grant insert (prompt_id, just_listen) on public.entries to authenticated;

-- Pages --------------------------------------------------------------------------------------

create table public.entry_pages (
  entry_id uuid not null references public.entries (id) on delete cascade,
  page_index smallint not null check (page_index between 0 and 9), -- at most 10 pages
  storage_path text not null unique,                               -- {user}/{entry}/{index}.jpg in "pages"
  created_at timestamptz not null default now(),
  primary key (entry_id, page_index)
);

alter table public.entry_pages enable row level security;

create policy "Users read their own pages"
  on public.entry_pages for select to authenticated
  using (exists (select 1 from public.entries e where e.id = entry_id and e.user_id = (select auth.uid())));

create policy "Users add pages to their own entry while it uploads"
  on public.entry_pages for insert to authenticated
  with check (
    storage_path = (select auth.uid())::text || '/' || entry_id::text || '/' || page_index::text || '.jpg'
    and exists (
      select 1 from public.entries e
      where e.id = entry_id and e.user_id = (select auth.uid()) and e.status = 'uploading')
  );

revoke all on public.entry_pages from anon;
revoke update, delete, truncate, references, trigger on public.entry_pages from authenticated;

-- Marks an entry uploaded once it has pages and every page's photo is in storage, and gives it
-- the user's next entry number. Calling it again after success is a no-op, so a retry after a
-- lost response is safe.
create function public.complete_entry_upload(p_entry_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Serialise numbering for this user (two entries finishing at the same moment).
  perform pg_advisory_xact_lock(hashtextextended('entries:' || auth.uid()::text, 0));

  update public.entries e set
    status = 'uploaded',
    entry_number = (select coalesce(max(e2.entry_number), 0) + 1 from public.entries e2 where e2.user_id = e.user_id)
  where e.id = p_entry_id
    and e.user_id = auth.uid()
    and e.status = 'uploading'
    and exists (select 1 from public.entry_pages p where p.entry_id = e.id)
    and not exists (
      select 1 from public.entry_pages p
      where p.entry_id = e.id
        and not exists (select 1 from storage.objects o where o.bucket_id = 'pages' and o.name = p.storage_path));
  if found then return; end if;

  if exists (select 1 from public.entries e where e.id = p_entry_id and e.user_id = auth.uid() and e.status <> 'uploading') then
    return;
  end if;
  raise exception 'Entry not found, or its pages are missing' using errcode = 'P0002';
end;
$$;

revoke execute on function public.complete_entry_upload(uuid) from public, anon;
grant execute on function public.complete_entry_upload(uuid) to authenticated;

-- Page photos: private bucket, JPEG only, laid out as {user}/{entry}/{index}.jpg. Users can
-- read their own, and add photos only to their own entry while it is uploading.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pages', 'pages', false, 5242880, array['image/jpeg']);

create policy "Users read their own page photos"
  on storage.objects for select to authenticated
  using (bucket_id = 'pages' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users upload page photos to their own entry"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'pages'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1 from public.entries e
      where e.id::text = (storage.foldername(name))[2]
        and e.user_id = (select auth.uid())
        and e.status = 'uploading')
  );

-- Read models --------------------------------------------------------------------------------

-- Streak: consecutive journal days with an uploaded entry, ending today, or yesterday if today
-- isn't written yet. week is Monday to Sunday of this week: done | today (not yet written) | empty.
create function public.get_streak()
returns table (days int, written_today boolean, week text[], today date)
language sql
stable
set search_path = ''
as $$
  with t as (select public.user_today() as d),
  written as (
    select distinct e.local_date as d from public.entries e
    where e.user_id = (select auth.uid()) and e.status <> 'uploading'
  ),
  anchor as (
    select case
      when exists (select 1 from written w where w.d = t.d) then t.d
      when exists (select 1 from written w where w.d = t.d - 1) then t.d - 1
    end as d
    from t
  ),
  ranked as (
    select a.d - w.d as gap, row_number() over (order by w.d desc) - 1 as rn
    from written w, anchor a
    where a.d is not null and w.d <= a.d
  ),
  monday as (select t.d - (extract(isodow from t.d)::int - 1) as d from t)
  select
    (select count(*)::int from ranked r where r.gap = r.rn),
    exists (select 1 from written w, t where w.d = t.d),
    array(
      select case
        when exists (select 1 from written w where w.d = m.d + i) then 'done'
        when m.d + i = t.d then 'today'
        else 'empty'
      end
      from monday m, t, generate_series(0, 6) as i
      order by i
    ),
    (select t.d from t);
$$;

create function public.get_profile_stats()
returns table (entry_count int, word_count int, page_count int)
language sql
stable
set search_path = ''
as $$
  select
    count(*)::int,
    coalesce(sum(e.word_count), 0)::int,
    (select count(*)::int from public.entry_pages p where p.entry_id in (
      select e2.id from public.entries e2 where e2.user_id = (select auth.uid()) and e2.status <> 'uploading'))
  from public.entries e
  where e.user_id = (select auth.uid()) and e.status <> 'uploading';
$$;

revoke execute on function public.get_streak() from public, anon;
revoke execute on function public.get_profile_stats() from public, anon;
grant execute on function public.get_streak() to authenticated;
grant execute on function public.get_profile_stats() to authenticated;

-- The prompt set -----------------------------------------------------------------------------
-- Plain, concrete questions an intermediate learner can answer on one page.

insert into public.prompts (text) values
  -- Today
  ('What was the best thing you ate today?'),
  ('Who made you smile today, and why?'),
  ('What is one small thing you want to remember about this week?'),
  ('Describe a place you walked past today as if to a friend.'),
  ('What did you learn today that surprised you?'),
  ('What was the hardest part of your day, and how did you handle it?'),
  ('Describe the first hour of your day in detail.'),
  ('What made you laugh today?'),
  ('What conversation from today is still on your mind?'),
  ('What did you do today that you were proud of?'),
  ('Write about something that went wrong today. What would you do differently?'),
  ('What was the most boring part of today? Make it sound exciting.'),
  ('What did you spend the most time thinking about today?'),
  ('Describe the weather today and how it changed your mood.'),
  ('What did you buy recently, and why did you choose it?'),
  ('Who did you help today, or who helped you?'),
  ('What was the last thing you read? Tell a friend about it.'),
  ('What sounds did you hear today? Describe three of them.'),
  ('What is something you noticed today that you usually miss?'),
  ('If today had a title, what would it be and why?'),
  ('Describe your journey home today.'),
  ('What did you have for dinner? How was it made?'),
  ('What was the best moment of your evening?'),
  ('What did you do today just for yourself?'),
  ('Write about a message you received today.'),
  -- People
  ('Describe your best friend to someone who has never met them.'),
  ('Who is a person you admire, and what do they do well?'),
  ('Write about a teacher you still remember.'),
  ('What is something a family member always says?'),
  ('Describe a neighbour or colleague in five sentences.'),
  ('Who would you like to call this week, and what would you tell them?'),
  ('Write a short thank-you note to someone who helped you this year.'),
  ('Describe someone you met for the first time recently.'),
  ('What is a habit of someone close to you that you love?'),
  ('If you could have dinner with anyone, who would it be and why?'),
  ('Write about a time someone surprised you.'),
  ('Who taught you to cook something? Describe the lesson.'),
  ('What advice would your grandparents give you today?'),
  ('Describe a friend you have lost touch with.'),
  ('Who do you talk to most often, and what do you talk about?'),
  -- Food
  ('Describe your favourite street food to someone who has never tried it.'),
  ('Write the recipe for a dish you can cook without looking.'),
  ('What did you eat as a child that you still miss?'),
  ('Describe the best meal you have ever had.'),
  ('What food do you dislike, and why?'),
  ('Describe your perfect breakfast.'),
  ('Write about a meal you shared with family.'),
  ('What would you cook for a guest from another country?'),
  ('Describe a festival dish and the day you eat it.'),
  ('Tea or coffee? Defend your choice like a lawyer.'),
  -- Places
  ('Describe your bedroom as if you were reviewing a hotel.'),
  ('Write about the street where you grew up.'),
  ('What is your favourite place in your city, and why?'),
  ('Describe a trip you took and one thing that went wrong.'),
  ('Where would you go tomorrow if you could go anywhere?'),
  ('Describe your workplace or classroom to a stranger.'),
  ('Write about a place that makes you feel calm.'),
  ('Describe the view from your window right now.'),
  ('What would you show a visitor in your hometown?'),
  ('Write about a market you like to visit.'),
  ('Describe a train, bus or car journey you remember well.'),
  ('What is a place you want to visit before next year?'),
  -- Work and study
  ('What did you work on today? Explain it to a ten-year-old.'),
  ('Describe a meeting or class from today.'),
  ('What is a skill you are getting better at?'),
  ('Write about a mistake at work or school and what you learned.'),
  ('What would make tomorrow a good day at work?'),
  ('Describe your dream job in detail.'),
  ('What is a task you keep putting off? Why?'),
  ('Write an email to your boss or teacher about something you want to change.'),
  ('What did you finish this week?'),
  ('Describe a colleague or classmate who makes your day easier.'),
  ('What part of your job or studies do you enjoy most?'),
  ('What would you do with one extra hour every day?'),
  -- Feelings
  ('What is worrying you at the moment? Write it down and let it go.'),
  ('When did you last feel really proud?'),
  ('Describe a moment today when you felt calm.'),
  ('What makes you feel nervous, and how do you deal with it?'),
  ('Write about something that made you angry recently.'),
  ('What are three things you are grateful for tonight?'),
  ('What would make you happy this weekend?'),
  ('Describe how you feel right now in three different ways.'),
  ('What is something you are looking forward to?'),
  ('When do you feel most like yourself?'),
  ('Write about a time you felt homesick.'),
  ('What gives you energy, and what takes it away?'),
  -- Memories
  ('Write about your earliest memory.'),
  ('Describe your first day at a new school or job.'),
  ('What is a birthday you will never forget?'),
  ('Write about a time you got lost.'),
  ('Describe a game you played as a child.'),
  ('What is a song that brings back a memory? Tell the story.'),
  ('Write about a time you were very brave.'),
  ('Describe a photo you love and the day it was taken.'),
  ('What was the best gift you ever received?'),
  ('Write about a holiday from your childhood.'),
  ('What did you believe as a child that turned out to be wrong?'),
  ('Describe a time you laughed so much you could not stop.'),
  ('Write about the first time you spoke English with a stranger.'),
  ('What did you want to be when you grew up?'),
  -- Senses
  ('Describe something you can smell right now.'),
  ('Pick an object near you and describe it without naming it.'),
  ('Describe the sky this evening.'),
  ('What is the most comfortable piece of clothing you own? Describe it.'),
  ('Describe your phone’s home screen and what it says about you.'),
  ('Describe the sounds of your home at night.'),
  ('Describe your favourite season using all five senses.'),
  ('Describe a busy moment in your city as if it were a film scene.'),
  -- Plans and dreams
  ('What do you want to do this weekend, and with whom?'),
  ('What is one goal for next month? How will you start?'),
  ('Describe your life five years from now.'),
  ('If you won a big prize tomorrow, what would you do first?'),
  ('What is a small change you want to make this week?'),
  ('What do you want to learn next, and why?'),
  ('Plan your perfect day off, from morning to night.'),
  ('What would you do if you were not afraid?'),
  ('What is a habit you want to start, and what is stopping you?'),
  ('Write a letter to yourself one year from now.'),
  -- Opinions
  ('Is it better to live in a city or a village? Explain.'),
  ('What is the best invention of the last hundred years?'),
  ('Should phones be allowed at the dinner table? Why or why not?'),
  ('What makes a good friend?'),
  ('What is a film or series everyone likes but you don’t?'),
  ('Is it better to plan everything or to be spontaneous?'),
  ('What rule would you add to your city?'),
  ('What is one thing schools should teach but don’t?'),
  ('Would you rather travel to the past or the future? Why?'),
  ('What is the most useful app on your phone?'),
  -- English
  ('What English word did you hear or read today? Use it three times.'),
  ('What is hard about English for you, and what helps?'),
  ('Describe a moment when you wanted to speak English but felt stuck.'),
  ('Write about a word in your language that has no English translation.'),
  ('Retell a joke you know, in English.'),
  ('Explain how to do something you are good at, step by step.'),
  ('Describe a film or video you watched in English.'),
  ('Write about a conversation you would like to be able to have in English.'),
  -- Imagination
  ('You wake up with a new superpower. What happens next?'),
  ('Write the first page of a story that starts in your kitchen.'),
  ('If your pet or plant could talk, what would it say about you?'),
  ('You can live one day as someone else. Who do you choose?'),
  ('Describe a city in the year 2100.'),
  ('Invent a holiday. What do people do on that day?'),
  ('You find a letter on the street. What does it say?'),
  ('Write about a day without the internet.'),
  ('If you could change one thing about today, what would it be?'),
  ('Describe a dream you had recently, even a strange one.'),
  -- Small things
  ('What is a small thing that made your day better?'),
  ('Write about something you own that you would never sell.'),
  ('Who or what are you thankful for this week?'),
  ('What is something kind you did or saw today?');
