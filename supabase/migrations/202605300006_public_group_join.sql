-- Public group discovery and direct join without exposing invite codes.
-- Public groups can be listed in the app, and signed-in users can join by group id.

create or replace function public.get_public_groups_for_discovery()
returns jsonb
language sql
stable
security definer
set search_path = public, private
as $$
with public_groups as (
  select g.id, g.name, g.created_at
  from public.groups g
  where g.is_public = true
),
media_counts as (
  select group_id, count(*)::integer as item_count, coalesce(avg(my_rating) filter (where my_rating is not null), 0)::numeric as average_rating
  from (
    select group_id, my_rating from public.movies where group_id is not null
    union all
    select group_id, my_rating from public.series where group_id is not null
    union all
    select group_id, my_rating from public.games where group_id is not null
  ) media
  group by group_id
),
member_counts as (
  select group_id, count(*)::integer as member_count
  from public.group_members
  group by group_id
)
select coalesce(jsonb_agg(
  jsonb_build_object(
    'id', pg.id,
    'name', pg.name,
    'createdAt', pg.created_at,
    'memberCount', coalesce(mc.member_count, 0),
    'itemCount', coalesce(media.item_count, 0),
    'averageRating', round(coalesce(media.average_rating, 0), 2),
    'isMember', private.is_group_member(pg.id, auth.uid())
  )
  order by coalesce(media.average_rating, 0) desc, coalesce(media.item_count, 0) desc, coalesce(mc.member_count, 0) desc, pg.name asc
), '[]'::jsonb)
from public_groups pg
left join member_counts mc on mc.group_id = pg.id
left join media_counts media on media.group_id = pg.id;
$$;

grant execute on function public.get_public_groups_for_discovery() to anon, authenticated;

create or replace function public.join_public_group(group_id_input uuid, display_name_input text default null)
returns public.groups
language plpgsql
security definer
set search_path = public, private
as $$
declare
  current_user_id uuid := auth.uid();
  profile_name text;
  joined_group public.groups;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to join a public group.';
  end if;

  select * into joined_group
  from public.groups
  where id = group_id_input and is_public = true;

  if not found then
    raise exception 'This public group is not available.';
  end if;

  insert into public.profiles (id, email, display_name, updated_at)
  values (
    current_user_id,
    auth.jwt() ->> 'email',
    coalesce(nullif(trim(display_name_input), ''), auth.jwt() -> 'user_metadata' ->> 'display_name', split_part(auth.jwt() ->> 'email', '@', 1), 'Member'),
    now()
  )
  on conflict (id) do update
  set display_name = coalesce(nullif(trim(display_name_input), ''), public.profiles.display_name),
      updated_at = now();

  select display_name into profile_name
  from public.profiles
  where id = current_user_id;

  insert into public.group_members (group_id, user_id, display_name, role)
  values (joined_group.id, current_user_id, coalesce(profile_name, 'Member'), 'member')
  on conflict (group_id, user_id) do update
  set display_name = excluded.display_name;

  return joined_group;
end;
$$;

grant execute on function public.join_public_group(uuid, text) to authenticated;
