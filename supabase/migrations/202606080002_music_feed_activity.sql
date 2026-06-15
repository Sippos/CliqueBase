-- Add music saves to the community activity timeline.
-- Run after 202606080001_music_items.sql and the activity feed migrations.

alter table public.activity_events drop constraint if exists activity_events_type_check;
alter table public.activity_events add constraint activity_events_type_check check (type in (
  'recommendation_note',
  'media_comment',
  'media_share',
  'library_add',
  'completed',
  'clique_join',
  'friend_accept',
  'rating',
  'vote',
  'system'
));

create or replace function private.record_music_library_activity()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  actor_id_value uuid := coalesce(new.owner_id, auth.uid());
  music_id_value text;
begin
  if actor_id_value is null then
    return new;
  end if;

  if new.group_id is not null and not private.is_group_member(new.group_id, actor_id_value) then
    return new;
  end if;

  music_id_value := coalesce(nullif(new.source_id, ''), new.id::text);

  if tg_op = 'INSERT' then
    perform private.record_activity(
      actor_id_value,
      new.group_id,
      'library_add',
      'music',
      music_id_value,
      new.title,
      jsonb_build_object(
        'scope', case when new.group_id is null then 'library' else 'clique' end,
        'poster', new.poster,
        'overview', trim(coalesce(new.artist, '') || case when new.artist is not null and new.album is not null then ' · ' else '' end || coalesce(new.album, '')),
        'artist', new.artist,
        'album', new.album,
        'source', new.source,
        'sourceId', new.source_id,
        'itemType', new.item_type,
        'url', new.url,
        'previewUrl', new.preview_url,
        'nominatedBy', new.nominated_by
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists record_music_feed_activity on public.music_items;
create trigger record_music_feed_activity
after insert on public.music_items
for each row execute function private.record_music_library_activity();

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
  inserted_music public.music_items;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to share media.';
  end if;

  if group_id_input is null or not private.is_group_member(group_id_input, current_user_id) then
    raise exception 'Choose one of your cliques first.';
  end if;

  if clean_item_type not in ('movie', 'series', 'game', 'music') then
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
    insert into public.movies (group_id, movie_id, title, year, released, poster, backdrop, overview, tmdb_rating, runtime, genres, nominated_by, updated_at)
    values (group_id_input, payload_id, payload_title, nullif(payload ->> 'year', ''), nullif(payload ->> 'released', '')::date, payload ->> 'poster', payload ->> 'backdrop', payload ->> 'overview', nullif(payload ->> 'tmdbRating', '')::numeric, nullif(payload ->> 'runtime', '')::integer, coalesce(array(select jsonb_array_elements_text(payload -> 'genres')), '{}'), nominated_by_name, now())
    on conflict (group_id, movie_id) do update set title = excluded.title, year = coalesce(excluded.year, public.movies.year), released = coalesce(excluded.released, public.movies.released), poster = coalesce(excluded.poster, public.movies.poster), backdrop = coalesce(excluded.backdrop, public.movies.backdrop), overview = coalesce(excluded.overview, public.movies.overview), tmdb_rating = coalesce(excluded.tmdb_rating, public.movies.tmdb_rating), runtime = coalesce(excluded.runtime, public.movies.runtime), genres = case when array_length(excluded.genres, 1) is not null then excluded.genres else public.movies.genres end, nominated_by = excluded.nominated_by, updated_at = now();
  elsif clean_item_type = 'series' then
    insert into public.series (group_id, series_id, title, year, released, poster, backdrop, overview, tmdb_rating, runtime, genres, seasons, episodes, nominated_by, updated_at)
    values (group_id_input, payload_id, payload_title, nullif(payload ->> 'year', ''), nullif(payload ->> 'released', '')::date, payload ->> 'poster', payload ->> 'backdrop', payload ->> 'overview', nullif(payload ->> 'tmdbRating', '')::numeric, nullif(payload ->> 'runtime', '')::integer, coalesce(array(select jsonb_array_elements_text(payload -> 'genres')), '{}'), nullif(payload ->> 'seasons', '')::integer, nullif(payload ->> 'episodes', '')::integer, nominated_by_name, now())
    on conflict (group_id, series_id) do update set title = excluded.title, year = coalesce(excluded.year, public.series.year), released = coalesce(excluded.released, public.series.released), poster = coalesce(excluded.poster, public.series.poster), backdrop = coalesce(excluded.backdrop, public.series.backdrop), overview = coalesce(excluded.overview, public.series.overview), tmdb_rating = coalesce(excluded.tmdb_rating, public.series.tmdb_rating), runtime = coalesce(excluded.runtime, public.series.runtime), genres = case when array_length(excluded.genres, 1) is not null then excluded.genres else public.series.genres end, seasons = coalesce(excluded.seasons, public.series.seasons), episodes = coalesce(excluded.episodes, public.series.episodes), nominated_by = excluded.nominated_by, updated_at = now();
  elsif clean_item_type = 'game' then
    insert into public.games (group_id, game_id, title, year, released, poster, backdrop, overview, rawg_rating, genres, platform, platforms, nominated_by, updated_at)
    values (group_id_input, payload_id, payload_title, nullif(payload ->> 'year', ''), nullif(payload ->> 'released', '')::date, payload ->> 'poster', payload ->> 'backdrop', payload ->> 'overview', nullif(payload ->> 'rawgRating', '')::numeric, coalesce(array(select jsonb_array_elements_text(payload -> 'genres')), '{}'), nullif(payload ->> 'platform', ''), coalesce(array(select jsonb_array_elements_text(payload -> 'platforms')), '{}'), nominated_by_name, now())
    on conflict (group_id, game_id) do update set title = excluded.title, year = coalesce(excluded.year, public.games.year), released = coalesce(excluded.released, public.games.released), poster = coalesce(excluded.poster, public.games.poster), backdrop = coalesce(excluded.backdrop, public.games.backdrop), overview = coalesce(excluded.overview, public.games.overview), rawg_rating = coalesce(excluded.rawg_rating, public.games.rawg_rating), genres = case when array_length(excluded.genres, 1) is not null then excluded.genres else public.games.genres end, platform = coalesce(excluded.platform, public.games.platform), platforms = case when array_length(excluded.platforms, 1) is not null then excluded.platforms else public.games.platforms end, nominated_by = excluded.nominated_by, updated_at = now();
  elsif clean_item_type = 'music' then
    insert into public.music_items (owner_id, group_id, source, source_id, item_type, title, artist, album, url, poster, preview_url, nominated_by, saved, updated_at)
    values (current_user_id, group_id_input, coalesce(nullif(payload ->> 'source', ''), nullif(payload ->> 'platform', ''), 'Music link'), payload_id, coalesce(nullif(payload ->> 'itemType', ''), 'track'), payload_title, nullif(payload ->> 'artist', ''), nullif(payload ->> 'album', ''), coalesce(nullif(payload ->> 'url', ''), '#'), nullif(payload ->> 'poster', ''), nullif(payload ->> 'previewUrl', ''), nominated_by_name, false, now())
    on conflict do nothing
    returning * into inserted_music;

    if inserted_music.id is null then
      perform private.record_activity(
        current_user_id,
        group_id_input,
        'library_add',
        'music',
        payload_id,
        payload_title,
        payload || jsonb_build_object('scope', 'clique', 'nominatedBy', nominated_by_name)
      );
    end if;
  end if;

  if clean_item_type <> 'music' then
    perform private.record_activity(
      current_user_id,
      group_id_input,
      'library_add',
      clean_item_type,
      payload_id,
      payload_title,
      payload || jsonb_build_object('scope', 'clique')
    );
  end if;

  return jsonb_build_object('ok', true, 'groupId', group_id_input, 'type', clean_item_type, 'id', payload_id);
end;
$$;

grant execute on function public.share_media_with_clique(uuid, text, jsonb) to authenticated;
