-- Public group discovery without exposing invite codes.
-- Run after 202605300003_games_community_leaderboard.sql.

alter table public.groups add column if not exists is_public boolean not null default false;

create or replace function public.set_group_public(group_id_input uuid, is_public_input boolean)
returns public.groups
language plpgsql
security definer
set search_path = public, private
as $$
declare
  current_user_id uuid := auth.uid();
  updated_group public.groups;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to update group visibility.';
  end if;

  update public.groups
  set is_public = coalesce(is_public_input, false),
      updated_at = now()
  where id = group_id_input
    and owner_id = current_user_id
  returning * into updated_group;

  if not found then
    raise exception 'Only the group owner can update public discovery.';
  end if;

  return updated_group;
end;
$$;

grant execute on function public.set_group_public(uuid, boolean) to authenticated;

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
    '🎬'::text as icon,
    m.movie_id as item_id,
    m.title,
    m.poster,
    m.nominated_by,
    coalesce(m.score, 0)::integer as score,
    coalesce(m.picks, 0)::integer as picks,
    m.my_rating::numeric as rating,
    coalesce(m.watched, false) as completed
  from public.movies m
  join public_groups pg on pg.id = m.group_id

  union all

  select
    s.group_id,
    'Series'::text as category,
    '📺'::text as icon,
    s.series_id as item_id,
    s.title,
    s.poster,
    s.nominated_by,
    coalesce(s.score, 0)::integer as score,
    coalesce(s.picks, 0)::integer as picks,
    s.my_rating::numeric as rating,
    coalesce(s.finished, false) as completed
  from public.series s
  join public_groups pg on pg.id = s.group_id

  union all

  select
    ga.group_id,
    'Games'::text as category,
    '🎮'::text as icon,
    ga.game_id as item_id,
    ga.title,
    ga.poster,
    ga.nominated_by,
    coalesce(ga.score, 0)::integer as score,
    coalesce(ga.picks, 0)::integer as picks,
    ga.my_rating::numeric as rating,
    coalesce(ga.played, false) as completed
  from public.games ga
  join public_groups pg on pg.id = ga.group_id
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
        'score', score,
        'picks', picks,
        'rating', rating,
        'poster', poster,
        'completed', completed
      )
      order by completed desc, rating desc nulls last, score desc, picks desc, title asc
    ) as items
  from media
  group by group_id
),
top_content as (
  select
    m.*,
    g.name as group_name,
    row_number() over (order by m.score desc, m.picks desc, m.rating desc nulls last, m.title asc) as content_rank
  from media m
  join public_groups g on g.id = m.group_id
),
ranked_groups as (
  select
    gr.*,
    coalesce(gi.items, '[]'::jsonb) as public_items,
    row_number() over (order by gr.average_rating desc, gr.completed_count desc, gr.total_score desc, gr.total_picks desc, gr.member_count desc, gr.name asc) as group_rank
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
        'id', item_id,
        'groupId', group_id,
        'groupName', group_name,
        'category', category,
        'icon', icon,
        'title', title,
        'poster', poster,
        'nominatedBy', nominated_by,
        'score', score,
        'picks', picks,
        'rating', rating,
        'completed', completed
      )
      order by content_rank
    )
    from top_content
    where content_rank <= 50
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
