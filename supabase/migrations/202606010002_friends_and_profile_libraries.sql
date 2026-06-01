-- Friends list and member profile library support.
-- Run after the member sharing migrations.

create table if not exists public.user_friends (
  user_id uuid not null references auth.users(id) on delete cascade,
  friend_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);

create index if not exists user_friends_friend_id_idx on public.user_friends(friend_id);
create index if not exists user_friends_user_created_idx on public.user_friends(user_id, created_at desc);

alter table public.user_friends enable row level security;

drop policy if exists "Friends are readable by owner" on public.user_friends;
drop policy if exists "Friends are insertable by owner" on public.user_friends;
drop policy if exists "Friends are deletable by owner" on public.user_friends;

create policy "Friends are readable by owner" on public.user_friends
for select to authenticated
using (user_id = (select auth.uid()) or friend_id = (select auth.uid()));

create policy "Friends are insertable by owner" on public.user_friends
for insert to authenticated
with check (user_id = (select auth.uid()));

create policy "Friends are deletable by owner" on public.user_friends
for delete to authenticated
using (user_id = (select auth.uid()));

drop function if exists public.search_members_by_profile_name(text, integer);
create function public.search_members_by_profile_name(search_input text, limit_input integer default 10)
returns table(id uuid, display_name text, is_friend boolean, library_count integer)
language sql
stable
security definer
set search_path = public
as $$
  with personal_counts as (
    select owner_id as member_id, count(*)::integer as item_count
    from (
      select owner_id from public.movies where owner_id is not null and group_id is null
      union all
      select owner_id from public.series where owner_id is not null and group_id is null
      union all
      select owner_id from public.games where owner_id is not null and group_id is null
    ) media
    group by owner_id
  )
  select
    p.id,
    p.display_name,
    exists (
      select 1 from public.user_friends uf
      where uf.user_id = auth.uid()
        and uf.friend_id = p.id
    ) as is_friend,
    coalesce(pc.item_count, 0)::integer as library_count
  from public.profiles p
  left join personal_counts pc on pc.member_id = p.id
  where auth.uid() is not null
    and p.id <> auth.uid()
    and length(trim(coalesce(search_input, ''))) >= 2
    and p.display_name ilike '%' || trim(search_input) || '%'
  order by
    case when lower(p.display_name) = lower(trim(search_input)) then 0 else 1 end,
    exists (
      select 1 from public.user_friends uf
      where uf.user_id = auth.uid()
        and uf.friend_id = p.id
    ) desc,
    p.display_name asc
  limit greatest(1, least(coalesce(limit_input, 10), 25));
$$;

create or replace function public.add_friend(friend_id_input uuid)
returns table(id uuid, display_name text, is_friend boolean, library_count integer, created_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'You must be signed in to add friends.';
  end if;

  if friend_id_input is null or friend_id_input = current_user_id then
    raise exception 'Choose another member to add.';
  end if;

  if not exists (select 1 from public.profiles p where p.id = friend_id_input) then
    raise exception 'No member found for that profile.';
  end if;

  insert into public.user_friends (user_id, friend_id)
  values (current_user_id, friend_id_input)
  on conflict (user_id, friend_id) do nothing;

  return query
  with personal_counts as (
    select owner_id as member_id, count(*)::integer as item_count
    from (
      select owner_id from public.movies where owner_id = friend_id_input and group_id is null
      union all
      select owner_id from public.series where owner_id = friend_id_input and group_id is null
      union all
      select owner_id from public.games where owner_id = friend_id_input and group_id is null
    ) media
    group by owner_id
  )
  select p.id, p.display_name, true, coalesce(pc.item_count, 0)::integer, uf.created_at
  from public.user_friends uf
  join public.profiles p on p.id = uf.friend_id
  left join personal_counts pc on pc.member_id = p.id
  where uf.user_id = current_user_id and uf.friend_id = friend_id_input;
end;
$$;

create or replace function public.remove_friend(friend_id_input uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'You must be signed in to manage friends.';
  end if;

  delete from public.user_friends
  where user_id = current_user_id
    and friend_id = friend_id_input;
end;
$$;

create or replace function public.get_my_friends()
returns table(id uuid, display_name text, is_friend boolean, library_count integer, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  with personal_counts as (
    select owner_id as member_id, count(*)::integer as item_count
    from (
      select owner_id from public.movies where owner_id is not null and group_id is null
      union all
      select owner_id from public.series where owner_id is not null and group_id is null
      union all
      select owner_id from public.games where owner_id is not null and group_id is null
    ) media
    group by owner_id
  )
  select p.id, p.display_name, true as is_friend, coalesce(pc.item_count, 0)::integer as library_count, uf.created_at
  from public.user_friends uf
  join public.profiles p on p.id = uf.friend_id
  left join personal_counts pc on pc.member_id = p.id
  where uf.user_id = auth.uid()
  order by uf.created_at desc, p.display_name asc;
$$;

create or replace function public.get_member_public_library(member_id_input uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with target_profile as (
    select
      p.id,
      p.display_name,
      (p.id = auth.uid()) as is_self,
      exists (
        select 1 from public.user_friends uf
        where uf.user_id = auth.uid()
          and uf.friend_id = p.id
      ) as is_friend
    from public.profiles p
    where p.id = member_id_input
  ),
  media as (
    select
      'Movie'::text as type,
      m.movie_id as id,
      m.title,
      m.year,
      m.released,
      m.poster,
      m.backdrop,
      m.overview,
      m.tmdb_rating,
      null::numeric as rawg_rating,
      m.runtime,
      m.genres,
      null::integer as seasons,
      null::integer as episodes,
      null::text as platform,
      array[]::text[] as platforms,
      m.my_rating::numeric as rating,
      coalesce(m.score, 0)::integer as score,
      coalesce(m.picks, 0)::integer as picks,
      m.updated_at
    from public.movies m
    where m.owner_id = member_id_input and m.group_id is null

    union all

    select
      'Series'::text as type,
      s.series_id as id,
      s.title,
      s.year,
      s.released,
      s.poster,
      s.backdrop,
      s.overview,
      s.tmdb_rating,
      null::numeric as rawg_rating,
      s.runtime,
      s.genres,
      s.seasons,
      s.episodes,
      null::text as platform,
      array[]::text[] as platforms,
      s.my_rating::numeric as rating,
      coalesce(s.score, 0)::integer as score,
      coalesce(s.picks, 0)::integer as picks,
      s.updated_at
    from public.series s
    where s.owner_id = member_id_input and s.group_id is null

    union all

    select
      'Game'::text as type,
      g.game_id as id,
      g.title,
      g.year,
      g.released,
      g.poster,
      g.backdrop,
      g.overview,
      null::numeric as tmdb_rating,
      g.rawg_rating,
      null::integer as runtime,
      g.genres,
      null::integer as seasons,
      null::integer as episodes,
      g.platform,
      g.platforms,
      g.my_rating::numeric as rating,
      coalesce(g.score, 0)::integer as score,
      coalesce(g.picks, 0)::integer as picks,
      g.updated_at
    from public.games g
    where g.owner_id = member_id_input and g.group_id is null
  ),
  ranked_media as (
    select * from media
    order by rating desc nulls last, score desc, picks desc, updated_at desc, title asc
  )
  select jsonb_build_object(
    'profile', coalesce((
      select jsonb_build_object(
        'id', tp.id,
        'displayName', tp.display_name,
        'isFriend', tp.is_friend,
        'isSelf', tp.is_self
      )
      from target_profile tp
    ), jsonb_build_object('id', member_id_input, 'displayName', 'Member', 'isFriend', false, 'isSelf', false)),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', rm.id,
        'type', rm.type,
        'title', rm.title,
        'year', rm.year,
        'released', rm.released,
        'poster', rm.poster,
        'backdrop', rm.backdrop,
        'overview', rm.overview,
        'tmdbRating', rm.tmdb_rating,
        'rawgRating', rm.rawg_rating,
        'runtime', rm.runtime,
        'genres', rm.genres,
        'seasons', rm.seasons,
        'episodes', rm.episodes,
        'platform', rm.platform,
        'platforms', rm.platforms,
        'rating', rm.rating,
        'score', rm.score,
        'picks', rm.picks
      ))
      from ranked_media rm
    ), '[]'::jsonb),
    'totals', jsonb_build_object(
      'items', (select count(*) from media),
      'movies', (select count(*) from media where type = 'Movie'),
      'series', (select count(*) from media where type = 'Series'),
      'games', (select count(*) from media where type = 'Game')
    )
  );
$$;

grant execute on function public.search_members_by_profile_name(text, integer) to authenticated;
grant execute on function public.add_friend(uuid) to authenticated;
grant execute on function public.remove_friend(uuid) to authenticated;
grant execute on function public.get_my_friends() to authenticated;
grant execute on function public.get_member_public_library(uuid) to authenticated;
