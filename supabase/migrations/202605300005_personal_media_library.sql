-- Personal media library support.
-- This lets signed-in users save movies, series, and games to their own library
-- without adding them to a group. Group rows still use group_id.

alter table public.movies add column if not exists owner_id uuid references auth.users(id) on delete cascade;
alter table public.series add column if not exists owner_id uuid references auth.users(id) on delete cascade;
alter table public.games add column if not exists owner_id uuid references auth.users(id) on delete cascade;

create index if not exists movies_owner_id_idx on public.movies(owner_id);
create index if not exists series_owner_id_idx on public.series(owner_id);
create index if not exists games_owner_id_idx on public.games(owner_id);

create unique index if not exists movies_owner_movie_unique on public.movies(owner_id, movie_id);
create unique index if not exists series_owner_series_unique on public.series(owner_id, series_id);
create unique index if not exists games_owner_game_unique on public.games(owner_id, game_id);

-- Remove old global-only unique indexes when present. Personal libraries need each user
-- to be able to save the same TMDB/RAWG item independently.
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'movies_movie_id_key') then
    alter table public.movies drop constraint movies_movie_id_key;
  end if;
  if exists (select 1 from pg_constraint where conname = 'series_series_id_key') then
    alter table public.series drop constraint series_series_id_key;
  end if;
  if exists (select 1 from pg_constraint where conname = 'games_game_id_key') then
    alter table public.games drop constraint games_game_id_key;
  end if;
end $$;

drop index if exists movies_global_movie_unique;
drop index if exists series_global_series_unique;
drop index if exists games_global_game_unique;

-- Replace policies so private personal rows are visible only to the owner.
drop policy if exists "Movies are readable by group members" on public.movies;
drop policy if exists "Movies are insertable by group members" on public.movies;
drop policy if exists "Movies are updatable by group members" on public.movies;

create policy "Movies are readable by owner or group members" on public.movies
for select to authenticated
using (
  (group_id is null and owner_id = (select auth.uid()))
  or (group_id is not null and private.is_group_member(group_id, (select auth.uid())))
);

create policy "Movies are insertable by owner or group members" on public.movies
for insert to authenticated
with check (
  (group_id is null and owner_id = (select auth.uid()))
  or (group_id is not null and private.is_group_member(group_id, (select auth.uid())))
);

create policy "Movies are updatable by owner or group members" on public.movies
for update to authenticated
using (
  (group_id is null and owner_id = (select auth.uid()))
  or (group_id is not null and private.is_group_member(group_id, (select auth.uid())))
)
with check (
  (group_id is null and owner_id = (select auth.uid()))
  or (group_id is not null and private.is_group_member(group_id, (select auth.uid())))
);

drop policy if exists "Series are readable by group members" on public.series;
drop policy if exists "Series are insertable by group members" on public.series;
drop policy if exists "Series are updatable by group members" on public.series;

create policy "Series are readable by owner or group members" on public.series
for select to authenticated
using (
  (group_id is null and owner_id = (select auth.uid()))
  or (group_id is not null and private.is_group_member(group_id, (select auth.uid())))
);

create policy "Series are insertable by owner or group members" on public.series
for insert to authenticated
with check (
  (group_id is null and owner_id = (select auth.uid()))
  or (group_id is not null and private.is_group_member(group_id, (select auth.uid())))
);

create policy "Series are updatable by owner or group members" on public.series
for update to authenticated
using (
  (group_id is null and owner_id = (select auth.uid()))
  or (group_id is not null and private.is_group_member(group_id, (select auth.uid())))
)
with check (
  (group_id is null and owner_id = (select auth.uid()))
  or (group_id is not null and private.is_group_member(group_id, (select auth.uid())))
);

drop policy if exists "Games are readable by group members" on public.games;
drop policy if exists "Games are insertable by group members" on public.games;
drop policy if exists "Games are updatable by group members" on public.games;

create policy "Games are readable by owner or group members" on public.games
for select to authenticated
using (
  (group_id is null and owner_id = (select auth.uid()))
  or (group_id is not null and private.is_group_member(group_id, (select auth.uid())))
);

create policy "Games are insertable by owner or group members" on public.games
for insert to authenticated
with check (
  (group_id is null and owner_id = (select auth.uid()))
  or (group_id is not null and private.is_group_member(group_id, (select auth.uid())))
);

create policy "Games are updatable by owner or group members" on public.games
for update to authenticated
using (
  (group_id is null and owner_id = (select auth.uid()))
  or (group_id is not null and private.is_group_member(group_id, (select auth.uid())))
)
with check (
  (group_id is null and owner_id = (select auth.uid()))
  or (group_id is not null and private.is_group_member(group_id, (select auth.uid())))
);

create or replace function public.vote_movie(movie_id_input text, vote_delta_input integer, group_id_input uuid default null)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to vote.';
  end if;

  if group_id_input is not null and not private.is_group_member(group_id_input, auth.uid()) then
    raise exception 'You must be a member of this group to vote.';
  end if;

  update public.movies
  set picks = greatest(0, coalesce(picks, 0) + 1),
      score = coalesce(score, 0) + coalesce(vote_delta_input, 0),
      updated_at = now()
  where movie_id = movie_id_input
    and (
      (group_id_input is not null and group_id = group_id_input)
      or (group_id_input is null and group_id is null and owner_id = auth.uid())
    );
end;
$$;

create or replace function public.vote_series(series_id_input text, vote_delta_input integer, group_id_input uuid default null)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to vote.';
  end if;

  if group_id_input is not null and not private.is_group_member(group_id_input, auth.uid()) then
    raise exception 'You must be a member of this group to vote.';
  end if;

  update public.series
  set picks = greatest(0, coalesce(picks, 0) + 1),
      score = coalesce(score, 0) + coalesce(vote_delta_input, 0),
      updated_at = now()
  where series_id = series_id_input
    and (
      (group_id_input is not null and group_id = group_id_input)
      or (group_id_input is null and group_id is null and owner_id = auth.uid())
    );
end;
$$;

create or replace function public.vote_game(game_id_input text, vote_delta_input integer, group_id_input uuid default null)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to vote.';
  end if;

  if group_id_input is not null and not private.is_group_member(group_id_input, auth.uid()) then
    raise exception 'You must be a member of this group to vote.';
  end if;

  update public.games
  set picks = greatest(0, coalesce(picks, 0) + 1),
      score = coalesce(score, 0) + coalesce(vote_delta_input, 0),
      updated_at = now()
  where game_id = game_id_input
    and (
      (group_id_input is not null and group_id = group_id_input)
      or (group_id_input is null and group_id is null and owner_id = auth.uid())
    );
end;
$$;

grant execute on function public.vote_movie(text, integer, uuid) to authenticated;
grant execute on function public.vote_series(text, integer, uuid) to authenticated;
grant execute on function public.vote_game(text, integer, uuid) to authenticated;
