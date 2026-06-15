-- Follow-up fix for Explore all categories.
-- Use this if 202606080002_explore_all_categories.sql fails with:
-- ERROR 42804: UNION types date and text cannot be matched.
-- This version keeps the released column as date in every UNION branch.

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
    m.movie_id::text as item_id,
    m.title::text as title,
    m.year::text as year,
    m.released::date as released,
    m.poster::text as poster,
    m.backdrop::text as backdrop,
    m.overview::text as overview,
    m.tmdb_rating::numeric as tmdb_rating,
    null::numeric as rawg_rating,
    m.runtime::integer as runtime,
    m.genres::text[] as genres,
    null::integer as seasons,
    null::integer as episodes,
    null::text as platform,
    '{}'::text[] as platforms,
    null::text as director,
    m.nominated_by::text as nominated_by,
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
    'Series'::text,
    'series'::text,
    s.series_id::text,
    s.title::text,
    s.year::text,
    s.released::date,
    s.poster::text,
    s.backdrop::text,
    s.overview::text,
    s.tmdb_rating::numeric,
    null::numeric,
    s.runtime::integer,
    s.genres::text[],
    s.seasons::integer,
    s.episodes::integer,
    null::text,
    '{}'::text[],
    null::text,
    s.nominated_by::text,
    coalesce(s.score, 0)::integer,
    coalesce(s.picks, 0)::integer,
    s.my_rating::numeric,
    coalesce(s.finished, false),
    s.updated_at
  from public.series s
  join public_groups pg on pg.id = s.group_id

  union all

  select
    ga.group_id,
    'Games'::text,
    'games'::text,
    ga.game_id::text,
    ga.title::text,
    ga.year::text,
    ga.released::date,
    ga.poster::text,
    ga.backdrop::text,
    ga.overview::text,
    null::numeric,
    ga.rawg_rating::numeric,
    null::integer,
    ga.genres::text[],
    null::integer,
    null::integer,
    ga.platform::text,
    ga.platforms::text[],
    null::text,
    ga.nominated_by::text,
    coalesce(ga.score, 0)::integer,
    coalesce(ga.picks, 0)::integer,
    ga.my_rating::numeric,
    coalesce(ga.played, false),
    ga.updated_at
  from public.games ga
  join public_groups pg on pg.id = ga.group_id

  union all

  select
    v.group_id,
    'Videos'::text,
    'videos'::text,
    v.video_id::text,
    v.title::text,
    v.year::text,
    null::date,
    v.poster::text,
    v.backdrop::text,
    coalesce(v.overview, v.url)::text,
    null::numeric,
    null::numeric,
    null::integer,
    '{}'::text[],
    null::integer,
    null::integer,
    v.platform::text,
    '{}'::text[],
    null::text,
    v.nominated_by::text,
    coalesce(v.score, 0)::integer,
    coalesce(v.picks, 0)::integer,
    null::numeric,
    coalesce(v.classic, false),
    v.updated_at
  from public.videos v
  join public_groups pg on pg.id = v.group_id

  union all

  select
    mi.group_id,
    'Music'::text,
    'music'::text,
    mi.id::text,
    mi.title::text,
    null::text,
    null::date,
    mi.poster::text,
    mi.poster::text,
    concat_ws(' · ', nullif(mi.artist, ''), nullif(mi.album, ''), nullif(mi.source, ''), nullif(mi.url, ''))::text,
    null::numeric,
    null::numeric,
    null::integer,
    array_remove(array[mi.artist, mi.album, mi.source], null)::text[],
    null::integer,
    null::integer,
    coalesce(mi.source, mi.item_type)::text,
    array_remove(array[mi.source, mi.item_type], null)::text[],
    null::text,
    mi.nominated_by::text,
    0::integer,
    0::integer,
    null::numeric,
    coalesce(mi.saved, false),
    mi.updated_at
  from public.music_items mi
  join public_groups pg on pg.id = mi.group_id

  union all

  select
    bi.group_id,
    'Books'::text,
    'books'::text,
    bi.id::text,
    bi.title::text,
    bi.year::text,
    null::date,
    bi.poster::text,
    bi.poster::text,
    bi.overview::text,
    null::numeric,
    null::numeric,
    null::integer,
    coalesce(bi.subjects, '{}'::text[]),
    null::integer,
    null::integer,
    coalesce(bi.source, bi.reading_status)::text,
    array_remove(array[bi.source, bi.reading_status, bi.age_band], null)::text[],
    array_to_string(bi.authors, ', ')::text,
    bi.nominated_by::text,
    0::integer,
    0::integer,
    null::numeric,
    bi.reading_status in ('read', 'finished', 'done'),
    bi.updated_at
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
