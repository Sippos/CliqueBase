-- Platform sharing targets: search my cliques and add shared media directly to a clique.
-- Run after the personal media library + people search migrations.

create or replace function public.search_my_cliques_by_name(search_input text default '', limit_input integer default 10)
returns table(id uuid, name text, member_count integer, is_public boolean)
language sql
stable
security definer
set search_path = public, private
as $$
  with cleaned as (
    select lower(trim(coalesce(search_input, ''))) as q,
           greatest(1, least(coalesce(limit_input, 10), 25)) as max_rows
  )
  select g.id,
         g.name,
         count(gm_all.user_id)::integer as member_count,
         coalesce(g.is_public, false) as is_public
  from public.groups g
  join public.group_members gm_self on gm_self.group_id = g.id and gm_self.user_id = auth.uid()
  left join public.group_members gm_all on gm_all.group_id = g.id
  cross join cleaned c
  where auth.uid() is not null
    and (c.q = '' or lower(g.name) like '%' || c.q || '%')
  group by g.id, g.name, g.is_public, c.q
  order by
    case when c.q <> '' and lower(g.name) = c.q then 0 else 1 end,
    case when c.q <> '' and lower(g.name) like c.q || '%' then 0 else 1 end,
    g.name asc
  limit (select max_rows from cleaned);
$$;

create or replace function public.share_media_with_clique(group_id_input uuid, item_type_input text, payload_input jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  current_user_id uuid := auth.uid();
  clean_item_type text := lower(trim(coalesce(item_type_input, '')));
  payload jsonb := coalesce(payload_input, '{}'::jsonb);
  payload_id text := nullif(payload ->> 'id', '');
  payload_title text := nullif(payload ->> 'title', '');
  nominated_by_name text := 'platform suggestion';
begin
  if current_user_id is null then
    raise exception 'You must be signed in to share media.';
  end if;

  if group_id_input is null or not private.is_group_member(group_id_input, current_user_id) then
    raise exception 'Choose one of your cliques first.';
  end if;

  if clean_item_type not in ('movie', 'series', 'game') then
    raise exception 'This content type cannot be shared yet.';
  end if;

  if payload_id is null or payload_title is null then
    raise exception 'Shared media payload is missing a title or id.';
  end if;

  select coalesce(nullif(trim(display_name), ''), 'platform suggestion')
  into nominated_by_name
  from public.profiles
  where id = current_user_id;

  if clean_item_type = 'movie' then
    insert into public.movies (
      group_id, movie_id, title, year, released, poster, backdrop, overview,
      tmdb_rating, runtime, genres, nominated_by, updated_at
    )
    values (
      group_id_input,
      payload_id,
      payload_title,
      nullif(payload ->> 'year', ''),
      nullif(payload ->> 'released', '')::date,
      payload ->> 'poster',
      payload ->> 'backdrop',
      payload ->> 'overview',
      nullif(payload ->> 'tmdbRating', '')::numeric,
      nullif(payload ->> 'runtime', '')::integer,
      coalesce(array(select jsonb_array_elements_text(payload -> 'genres')), '{}'),
      nominated_by_name,
      now()
    )
    on conflict (group_id, movie_id) do update set
      title = excluded.title,
      year = coalesce(excluded.year, public.movies.year),
      released = coalesce(excluded.released, public.movies.released),
      poster = coalesce(excluded.poster, public.movies.poster),
      backdrop = coalesce(excluded.backdrop, public.movies.backdrop),
      overview = coalesce(excluded.overview, public.movies.overview),
      tmdb_rating = coalesce(excluded.tmdb_rating, public.movies.tmdb_rating),
      runtime = coalesce(excluded.runtime, public.movies.runtime),
      genres = case when array_length(excluded.genres, 1) is not null then excluded.genres else public.movies.genres end,
      nominated_by = excluded.nominated_by,
      updated_at = now();
  elsif clean_item_type = 'series' then
    insert into public.series (
      group_id, series_id, title, year, released, poster, backdrop, overview,
      tmdb_rating, runtime, genres, seasons, episodes, nominated_by, updated_at
    )
    values (
      group_id_input,
      payload_id,
      payload_title,
      nullif(payload ->> 'year', ''),
      nullif(payload ->> 'released', '')::date,
      payload ->> 'poster',
      payload ->> 'backdrop',
      payload ->> 'overview',
      nullif(payload ->> 'tmdbRating', '')::numeric,
      nullif(payload ->> 'runtime', '')::integer,
      coalesce(array(select jsonb_array_elements_text(payload -> 'genres')), '{}'),
      nullif(payload ->> 'seasons', '')::integer,
      nullif(payload ->> 'episodes', '')::integer,
      nominated_by_name,
      now()
    )
    on conflict (group_id, series_id) do update set
      title = excluded.title,
      year = coalesce(excluded.year, public.series.year),
      released = coalesce(excluded.released, public.series.released),
      poster = coalesce(excluded.poster, public.series.poster),
      backdrop = coalesce(excluded.backdrop, public.series.backdrop),
      overview = coalesce(excluded.overview, public.series.overview),
      tmdb_rating = coalesce(excluded.tmdb_rating, public.series.tmdb_rating),
      runtime = coalesce(excluded.runtime, public.series.runtime),
      genres = case when array_length(excluded.genres, 1) is not null then excluded.genres else public.series.genres end,
      seasons = coalesce(excluded.seasons, public.series.seasons),
      episodes = coalesce(excluded.episodes, public.series.episodes),
      nominated_by = excluded.nominated_by,
      updated_at = now();
  elsif clean_item_type = 'game' then
    insert into public.games (
      group_id, game_id, title, year, released, poster, backdrop, overview,
      rawg_rating, genres, platform, platforms, nominated_by, updated_at
    )
    values (
      group_id_input,
      payload_id,
      payload_title,
      nullif(payload ->> 'year', ''),
      nullif(payload ->> 'released', '')::date,
      payload ->> 'poster',
      payload ->> 'backdrop',
      payload ->> 'overview',
      nullif(payload ->> 'rawgRating', '')::numeric,
      coalesce(array(select jsonb_array_elements_text(payload -> 'genres')), '{}'),
      nullif(payload ->> 'platform', ''),
      coalesce(array(select jsonb_array_elements_text(payload -> 'platforms')), '{}'),
      nominated_by_name,
      now()
    )
    on conflict (group_id, game_id) do update set
      title = excluded.title,
      year = coalesce(excluded.year, public.games.year),
      released = coalesce(excluded.released, public.games.released),
      poster = coalesce(excluded.poster, public.games.poster),
      backdrop = coalesce(excluded.backdrop, public.games.backdrop),
      overview = coalesce(excluded.overview, public.games.overview),
      rawg_rating = coalesce(excluded.rawg_rating, public.games.rawg_rating),
      genres = case when array_length(excluded.genres, 1) is not null then excluded.genres else public.games.genres end,
      platform = coalesce(excluded.platform, public.games.platform),
      platforms = case when array_length(excluded.platforms, 1) is not null then excluded.platforms else public.games.platforms end,
      nominated_by = excluded.nominated_by,
      updated_at = now();
  end if;

  return jsonb_build_object('ok', true, 'groupId', group_id_input, 'type', clean_item_type, 'id', payload_id);
end;
$$;

grant execute on function public.search_my_cliques_by_name(text, integer) to authenticated;
grant execute on function public.share_media_with_clique(uuid, text, jsonb) to authenticated;
