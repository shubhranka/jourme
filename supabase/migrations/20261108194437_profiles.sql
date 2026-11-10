-- One row per user, created by the app at the end of onboarding. Its absence is how the app
-- knows to show onboarding.

create type public.persona as enum ('cheerleader', 'professor', 'friend');

-- Entry dates are computed in the writer's timezone, so it has to be a name Postgres knows.
create function public.is_valid_timezone(tz text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (select 1 from pg_catalog.pg_timezone_names where name = tz);
$$;

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 50),
  native_language text not null check (char_length(btrim(native_language)) between 1 and 60),
  learning_goal text not null check (char_length(btrim(learning_goal)) between 1 and 120),
  persona public.persona not null default 'cheerleader',
  nudge_time time not null default '21:30',
  timezone text not null check (public.is_valid_timezone(timezone)),
  offer_just_listen boolean not null default true,
  expo_push_token text, -- Phase 6
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

create policy "Users read their own profile"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

create policy "Users create their own profile"
  on public.profiles for insert to authenticated
  with check ((select auth.uid()) = id);

create policy "Users update their own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Signed-out clients get nothing. A profile goes only when its account is deleted (the cascade
-- above), so nobody deletes it directly, and nobody rewrites the id or timestamps.
revoke all on public.profiles from anon;
revoke delete, truncate, references, trigger on public.profiles from authenticated;
revoke update on public.profiles from authenticated;
grant update (display_name, native_language, learning_goal, persona, nudge_time, timezone, offer_just_listen, expo_push_token)
  on public.profiles to authenticated;
