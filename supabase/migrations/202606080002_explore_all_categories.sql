-- Extend Explore/public leaderboard to include videos, music, and books.
-- Run after the videos/music/books migrations and 202605300004_public_group_discovery.sql.

create or replace function public.get_community_leaderboard()
returns jsonb
language sql
stable
security definer
set search_path = public, private
as $$
with public_groups as (
  select id, name, is_public
  from public.groups
  where is_public = true
),
media as (
  select
    m.group_id,
    'Movies'::text as category,
    'movies'::text as icon,
    m.movie_id as item_id,
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
    '{}'::text[] as platforms,
    null::text as director,
    m.nominated_by,
    coalesce(m.score, 0)::integer as score,
    coalesce(m.picks, 0)::integer as picks,
    m.my_rating::numeric as rating,
    coalesce(m.watched, false) as completed,
    m.updated_at as sort_date
  from public.movies m
  join public_groups pg on pg.id = m.group_id

  union all

  select
    s.group_id,
    'Series'::text as category,
    'series'::text as icon,
    s.series_id as item_id,
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
    '{}'::text[] as platforms,
    null::text as director,
    s.nominated_by,
    coalesce(s.score, 0)::integer as score,
    coalesce(s.picks, 0)::integer as picks,
    s.my_rating::numeric as rating,
    coalesce(s.finished, false) as completed,
    s.updated_at as sort_date
  from public.series s
  join public_groups pg on pg.id = s.group_id

  union all

  select
    ga.group_id,
    'Games'::text as category,
    'games'::text as icon,
    ga.game_id as item_id,
    ga.title,
    ga.year,
    ga.released,
    ga.poster,
    ga.backdrop,
    ga.overview,
    null::numeric as tmdb_rating,
    ga.rawg_rating,
    null::integer as runtime,
    ga.genres,
    null::integer as seasons,
    null::integer as episodes,
    ga.platform,
    ga.platforms,
    null::text as director,
    ga.nominated_by,
    coalesce(ga.score, 0)::integer as score,
    coalesce(ga.picks, 0)::integer as picks,
    ga.my_rating::numeric as rating,
    coalesce(ga.played, false) as completed,
    ga.updated_at as sort_date
  from public.games ga
  join public_groups pg on pg.id = ga.group_id

  union all

  select
    v.group_id,
    'Videos'::text as category,
    'videos'::text as icon,
    v.video_id as item_id,
    v.title,
    v.year,
    null::text as released,
    v.poster,
    v.backdrop,
    coalesce(v.overview, v.url) as overview,
    null::numeric as tmdb_rating,
    null::numeric as rawg_rating,
    null::integer as runtime,
    '{}'::text[] as genres,
    null::integer as seasons,
    null::integer as episodes,
    v.platform,
    '{}'::text[] as platforms,
    null::text as director,
    v.nominated_by,
    coalesce(v.score, 0)::integer as score,
    coalesce(v.picks, 0)::integer as picks,
    null::numeric as rating,
    coalesce(v.classic, false) as completed,
    v.updated_at as sort_date
  from public.videos v
  join public_groups pg on pg.id = v.group_id

  union all

  select
    mi.group_id,
    'Music'::text as category,
    'music'::text as icon,
    mi.id::text as item_id,
    mi.title,
    null::text as year,
    null::text as released,
    mi.poster,
    mi.poster as backdrop,
    concat_ws(' · ', nullif(mi.artist, ''), nullif(mi.album, ''), nullif(mi.source, ''), nullif(mi.url, '')) as overview,
    null::numeric as tmdb_rating,
    null::numeric as rawg_rating,
    null::integer as runtime,
    array_remove(array[mi.artist, mi.album, mi.source], null)::text[] as genres,
    null::integer as seasons,
    null::integer as episodes,
    coalesce(mi.source, mi.item_type) as platform,
    array_remove(array[mi.source, mi.item_type], null)::text[] as platforms,
    null::text as director,
    mi.nominated_by,
    0::integer as score,
    0::integer as picks,
    null::numeric as rating,
    coalesce(mi.saved, false) as completed,
    mi.updated_at as sort_date
  from public.music_items mi
  join public_groups pg on pg.id = mi.group_id

  union all

  select
    bi.group_id,
    'Books'::text as category,
    'books'::text as icon,
    bi.id::text as item_id,
    bi.title,
    bi.year,
    null::text as released,
    bi.poster,
    bi.poster as backdrop,
    bi.overview,
    null::numeric as tmdb_rating,
    null::numeric as rawg_rating,
    null::integer as runtime,
    coalesce(bi.subjects, '{}'::text[]) as genres,
    null::integer as seasons,
    null::integer as episodes,
    coalesce(bi.source, bi.reading_status) as platform,
    array_remove(array[bi.source, bi.reading_status, bi.age_band], null)::text[] as platforms,
    array_to_string(bi.authors, ', ') as director,
    bi.nominated_by,
    0::integer as score,
    0::integer as picks,
    null::numeric as rating,
    bi.reading_status in ('read', 'finished', 'done') as completed,
    bi.updated_at as sort_date
  from public.book_items bi
  join public_groups pg on pg.id = bi.group_id
),
ranked_media as (
  select
    m.*,
    row_number() over (
      partition by m.category
      order by m.score desc, m.picks desc, m.rating desc nulls last, m.completed desc, m.sort_date desc nulls last, m.title asc
    ) as category_rank
  from media m
),
group_rollup as (
  select
    g.id,
    g.name,
    count(distinct gm.user_id)::integer as member_count,
    count(m.item_id)::integer as item_count,
    coalesce(sum(m.score), 0)::integer as total_score,
    coalesce(sum(m.picks), 0)::integer as total_picks,
    coalesce(sum(case when m.completed then 1 else 0 end), 0)::integer as completed_count,
    round(coalesce(avg(m.rating) filter (where m.rating is not null), 0), 2)::numeric as average_rating
  from public_groups g
  left join public.group_members gm on gm.group_id = g.id
  left join media m on m.group_id = g.id
  group by g.id, g.name
),
group_items as (
  select
    group_id,
    jsonb_agg(
      jsonb_build_object(
        'id', item_id,
        'title', title,
        'category', category,
        'icon', icon,
        'year', year,
        'released', released,
        'poster', poster,
        'backdrop', backdrop,
        'overview', overview,
        'tmdbRating', tmdb_rating,
        'rawgRating', rawg_rating,
        'runtime', runtime,
        'genres', genres,
        'seasons', seasons,
        'episodes', episodes,
        'platform', platform,
        'platforms', platforms,
        'director', director,
        'nominatedBy', nominated_by,
        'score', score,
        'picks', picks,
        'rating', rating,
        'completed', completed,
        'categoryRank', category_rank
      )
      order by category_rank asc, score desc, picks desc, title asc
    ) as items
  from ranked_media
  group by group_id
),
top_content as (
  select
    rm.*,
    g.name as group_name,
    row_number() over (order by rm.score desc, rm.picks desc, rm.rating desc nulls last, rm.completed desc, rm.sort_date desc nulls last, rm.title asc) as content_rank
  from ranked_media rm
  join public_groups g on g.id = rm.group_id
),
ranked_groups as (
  select
    gr.*,
    coalesce(gi.items, '[]'::jsonb) as public_items,
    row_number() over (order by gr.item_count desc, gr.average_rating desc, gr.completed_count desc, gr.total_score desc, gr.total_picks desc, gr.member_count desc, gr.name asc) as group_rank
  from group_rollup gr
  left join group_items gi on gi.group_id = gr.id
)
select jsonb_build_object(
  'groups', coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'rank', group_rank,
        'id', id,
        'name', name,
        'memberCount', member_count,
        'itemCount', item_count,
        'totalScore', total_score,
        'totalPicks', total_picks,
        'completedCount', completed_count,
        'averageRating', average_rating,
        'publicItems', public_items,
        'topItems', coalesce((select jsonb_agg(value) from jsonb_array_elements(public_items) with ordinality where ordinality <= 6), '[]'::jsonb)
      )
      order by group_rank
    )
    from ranked_groups
    where group_rank <= 20
  ), '[]'::jsonb),
  'topContent', coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'rank', content_rank,
        'categoryRank', category_rank,
        'id', item_id,
        'groupId', group_id,
        'groupName', group_name,
        'category', category,
        'icon', icon,
        'year', year,
        'released', released,
        'title', title,
        'poster', poster,
        'backdrop', backdrop,
        'overview', overview,
        'tmdbRating', tmdb_rating,
        'rawgRating', rawg_rating,
        'runtime', runtime,
        'genres', genres,
        'seasons', seasons,
        'episodes', episodes,
        'platform', platform,
        'platforms', platforms,
        'director', director,
        'nominatedBy', nominated_by,
        'score', score,
        'picks', picks,
        'rating', rating,
        'completed', completed
      )
      order by content_rank
    )
    from top_content
    where content_rank <= 80
  ), '[]'::jsonb),
  'totals', jsonb_build_object(
    'publicGroups', (select count(*) from public_groups),
    'members', (select count(*) from public.group_members gm join public_groups pg on pg.id = gm.group_id),
    'items', (select count(*) from media),
    'picks', coalesce((select sum(picks) from media), 0),
    'score', coalesce((select sum(score) from media), 0)
  )
);
$$;

grant execute on function public.get_community_leaderboard() to anon, authenticated;
