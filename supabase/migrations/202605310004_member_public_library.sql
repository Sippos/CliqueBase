-- Read-only public member library preview.
-- This keeps profile discovery useful while only exposing items the member has already
-- put in public cliques. Private personal library rows stay hidden.

create or replace function public.get_member_public_library(member_id_input uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, private
as $$
with profile_row as (
  select
    p.id,
    coalesce(nullif(trim(p.display_name), ''), split_part(coalesce(p.email, ''), '@', 1), 'CliqueBase member') as display_name
  from public.profiles p
  where p.id = member_id_input
), member_public_groups as (
  select gm.group_id
  from public.group_members gm
  join public.groups g on g.id = gm.group_id
  where gm.user_id = member_id_input
    and coalesce(g.is_public, false) = true
), media as (
  select
    'Movie'::text as type,
    m.movie_id as id,
    m.title,
    m.year,
    m.released,
    m.poster,
    m.backdrop,
    m.overview,
    coalesce(m.score, 0)::integer as score,
    coalesce(m.picks, 0)::integer as picks,
    m.my_rating::numeric as rating
  from public.movies m
  join member_public_groups mpg on mpg.group_id = m.group_id

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
    coalesce(s.score, 0)::integer as score,
    coalesce(s.picks, 0)::integer as picks,
    s.my_rating::numeric as rating
  from public.series s
  join member_public_groups mpg on mpg.group_id = s.group_id

  union all

  select
    'Game'::text as type,
    ga.game_id as id,
    ga.title,
    ga.year,
    ga.released,
    ga.poster,
    ga.backdrop,
    ga.overview,
    coalesce(ga.score, 0)::integer as score,
    coalesce(ga.picks, 0)::integer as picks,
    ga.my_rating::numeric as rating
  from public.games ga
  join member_public_groups mpg on mpg.group_id = ga.group_id
)
select jsonb_build_object(
  'profile', coalesce((
    select jsonb_build_object('id', id, 'displayName', display_name)
    from profile_row
  ), jsonb_build_object('id', member_id_input, 'displayName', 'CliqueBase member')),
  'items', coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'type', type,
        'id', id,
        'title', title,
        'year', year,
        'released', released,
        'poster', poster,
        'backdrop', backdrop,
        'overview', overview,
        'score', score,
        'picks', picks,
        'rating', rating
      )
      order by score desc, picks desc, rating desc nulls last, title asc
    )
    from media
  ), '[]'::jsonb),
  'totals', jsonb_build_object(
    'items', coalesce((select count(*) from media), 0),
    'movies', coalesce((select count(*) from media where type = 'Movie'), 0),
    'series', coalesce((select count(*) from media where type = 'Series'), 0),
    'games', coalesce((select count(*) from media where type = 'Game'), 0)
  )
);
$$;

grant execute on function public.get_member_public_library(uuid) to authenticated;
