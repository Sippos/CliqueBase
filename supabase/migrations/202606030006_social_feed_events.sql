-- Richer feed events for community UX.
-- Feed should show social intent, not only explicit recommendation notes.

create extension if not exists pgcrypto;

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
  'system'
));

create or replace function private.record_media_library_activity()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  actor_id_value uuid := coalesce(new.owner_id, auth.uid());
  media_type text := tg_argv[0];
  media_id text;
  done_now boolean := false;
  done_before boolean := false;
  event_type text;
  event_payload jsonb;
begin
  if actor_id_value is null then
    return new;
  end if;

  if new.group_id is not null and not private.is_group_member(new.group_id, actor_id_value) then
    return new;
  end if;

  if media_type = 'movie' then
    media_id := new.movie_id;
    done_now := coalesce(new.watched, false);
    if tg_op = 'UPDATE' then done_before := coalesce(old.watched, false); end if;
  elsif media_type = 'series' then
    media_id := new.series_id;
    done_now := coalesce(new.finished, false);
    if tg_op = 'UPDATE' then done_before := coalesce(old.finished, false); end if;
  elsif media_type = 'game' then
    media_id := new.game_id;
    done_now := coalesce(new.played, false);
    if tg_op = 'UPDATE' then done_before := coalesce(old.played, false); end if;
  else
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.my_rating is not null then
      event_type := 'rating';
    elsif done_now then
      event_type := 'completed';
    else
      event_type := 'library_add';
    end if;
  elsif tg_op = 'UPDATE' then
    if new.my_rating is not null and new.my_rating is distinct from old.my_rating then
      event_type := 'rating';
    elsif done_now and not done_before then
      event_type := 'completed';
    else
      return new;
    end if;
  else
    return new;
  end if;

  event_payload := jsonb_build_object(
    'scope', case when new.group_id is null then 'library' else 'clique' end,
    'rating', new.my_rating,
    'done', done_now,
    'poster', new.poster,
    'backdrop', new.backdrop,
    'overview', new.overview,
    'nominatedBy', new.nominated_by
  );

  perform private.record_activity(
    actor_id_value,
    new.group_id,
    event_type,
    media_type,
    media_id,
    new.title,
    event_payload
  );

  return new;
end;
$$;

drop trigger if exists record_movies_feed_activity on public.movies;
create trigger record_movies_feed_activity
after insert or update of watched, my_rating on public.movies
for each row execute function private.record_media_library_activity('movie');

drop trigger if exists record_series_feed_activity on public.series;
create trigger record_series_feed_activity
after insert or update of finished, my_rating on public.series
for each row execute function private.record_media_library_activity('series');

drop trigger if exists record_games_feed_activity on public.games;
create trigger record_games_feed_activity
after insert or update of played, my_rating on public.games
for each row execute function private.record_media_library_activity('game');

create or replace function public.get_social_activity(limit_input integer default 40, include_public_input boolean default true)
returns table(
  id uuid,
  type text,
  actor_id uuid,
  actor_display_name text,
  group_id uuid,
  group_name text,
  item_type text,
  item_id text,
  title text,
  payload jsonb,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public, private
as $$
  select
    ae.id,
    ae.type,
    ae.actor_id,
    coalesce(nullif(trim(p.display_name), ''), split_part(coalesce(p.email, ''), '@', 1), 'CliqueBase member') as actor_display_name,
    ae.group_id,
    g.name as group_name,
    ae.item_type,
    ae.item_id,
    ae.title,
    ae.payload,
    ae.created_at
  from public.activity_events ae
  left join public.profiles p on p.id = ae.actor_id
  left join public.groups g on g.id = ae.group_id
  where auth.uid() is not null
    and (
      ae.actor_id = auth.uid()
      or private.is_group_member(ae.group_id, auth.uid())
      or exists (
        select 1
        from public.user_friends uf
        where uf.user_id = auth.uid()
          and uf.friend_id = ae.actor_id
      )
      or (include_public_input and ae.group_id is not null and coalesce(g.is_public, false))
    )
  order by ae.created_at desc
  limit greatest(1, least(coalesce(limit_input, 40), 100));
$$;

create or replace function public.respond_friend_request(request_id_input uuid, response_input text)
returns public.friend_requests
language plpgsql
security definer
set search_path = public, private
as $$
declare
  current_user_id uuid := auth.uid();
  clean_response text := lower(trim(coalesce(response_input, '')));
  updated_request public.friend_requests;
  friend_name text;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to respond to friend requests.';
  end if;

  if clean_response not in ('accepted', 'declined') then
    raise exception 'Friend request response must be accepted or declined.';
  end if;

  update public.friend_requests
  set status = clean_response,
      updated_at = now(),
      responded_at = now()
  where id = request_id_input
    and addressee_id = current_user_id
    and status = 'pending'
  returning * into updated_request;

  if not found then
    raise exception 'Friend request not found.';
  end if;

  if clean_response = 'accepted' then
    insert into public.user_friends (user_id, friend_id)
    values
      (updated_request.requester_id, updated_request.addressee_id),
      (updated_request.addressee_id, updated_request.requester_id)
    on conflict (user_id, friend_id) do nothing;

    select coalesce(nullif(trim(display_name), ''), split_part(coalesce(email, ''), '@', 1), 'CliqueBase member')
    into friend_name
    from public.profiles
    where id = updated_request.requester_id;

    perform private.create_notification(
      updated_request.requester_id,
      current_user_id,
      'friend_accept',
      'profile',
      current_user_id::text,
      jsonb_build_object('memberId', current_user_id)
    );

    perform private.record_activity(
      current_user_id,
      null,
      'friend_accept',
      'profile',
      updated_request.requester_id::text,
      coalesce(friend_name, 'CliqueBase member'),
      jsonb_build_object('friendId', updated_request.requester_id, 'friendName', friend_name)
    );
  end if;

  return updated_request;
end;
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
  end if;

  perform private.record_activity(
    current_user_id,
    group_id_input,
    'library_add',
    clean_item_type,
    payload_id,
    payload_title,
    payload || jsonb_build_object('scope', 'clique')
  );

  return jsonb_build_object('ok', true, 'groupId', group_id_input, 'type', clean_item_type, 'id', payload_id);
end;
$$;

grant execute on function public.get_social_activity(integer, boolean) to authenticated;
grant execute on function public.respond_friend_request(uuid, text) to authenticated;
grant execute on function public.share_media_with_clique(uuid, text, jsonb) to authenticated;
