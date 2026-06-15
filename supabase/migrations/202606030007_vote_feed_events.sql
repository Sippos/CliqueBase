-- Make personal/clique votes visible in the community feed.
-- Saving/rating/finishing was already covered by activity triggers; votes update score/picks through RPCs,
-- so they need explicit activity events.

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

create or replace function public.vote_movie(movie_id_input text, vote_delta_input integer, group_id_input uuid default null)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  current_user_id uuid := auth.uid();
  updated_row public.movies;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to vote.';
  end if;

  if group_id_input is not null and not private.is_group_member(group_id_input, current_user_id) then
    raise exception 'You must be a member of this group to vote.';
  end if;

  update public.movies
  set picks = greatest(0, coalesce(picks, 0) + 1),
      score = coalesce(score, 0) + coalesce(vote_delta_input, 0),
      updated_at = now()
  where movie_id = movie_id_input
    and (
      (group_id_input is not null and group_id = group_id_input)
      or (group_id_input is null and group_id is null and owner_id = current_user_id)
    )
  returning * into updated_row;

  if found then
    perform private.record_activity(
      current_user_id,
      updated_row.group_id,
      'vote',
      'movie',
      updated_row.movie_id,
      updated_row.title,
      jsonb_build_object(
        'vote', case when coalesce(vote_delta_input, 0) > 0 then 'like' else 'pass' end,
        'score', updated_row.score,
        'picks', updated_row.picks,
        'scope', case when updated_row.group_id is null then 'library' else 'clique' end,
        'poster', updated_row.poster,
        'backdrop', updated_row.backdrop,
        'overview', updated_row.overview
      )
    );
  end if;
end;
$$;

create or replace function public.vote_series(series_id_input text, vote_delta_input integer, group_id_input uuid default null)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  current_user_id uuid := auth.uid();
  updated_row public.series;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to vote.';
  end if;

  if group_id_input is not null and not private.is_group_member(group_id_input, current_user_id) then
    raise exception 'You must be a member of this group to vote.';
  end if;

  update public.series
  set picks = greatest(0, coalesce(picks, 0) + 1),
      score = coalesce(score, 0) + coalesce(vote_delta_input, 0),
      updated_at = now()
  where series_id = series_id_input
    and (
      (group_id_input is not null and group_id = group_id_input)
      or (group_id_input is null and group_id is null and owner_id = current_user_id)
    )
  returning * into updated_row;

  if found then
    perform private.record_activity(
      current_user_id,
      updated_row.group_id,
      'vote',
      'series',
      updated_row.series_id,
      updated_row.title,
      jsonb_build_object(
        'vote', case when coalesce(vote_delta_input, 0) > 0 then 'like' else 'pass' end,
        'score', updated_row.score,
        'picks', updated_row.picks,
        'scope', case when updated_row.group_id is null then 'library' else 'clique' end,
        'poster', updated_row.poster,
        'backdrop', updated_row.backdrop,
        'overview', updated_row.overview
      )
    );
  end if;
end;
$$;

create or replace function public.vote_game(game_id_input text, vote_delta_input integer, group_id_input uuid default null)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  current_user_id uuid := auth.uid();
  updated_row public.games;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to vote.';
  end if;

  if group_id_input is not null and not private.is_group_member(group_id_input, current_user_id) then
    raise exception 'You must be a member of this group to vote.';
  end if;

  update public.games
  set picks = greatest(0, coalesce(picks, 0) + 1),
      score = coalesce(score, 0) + coalesce(vote_delta_input, 0),
      updated_at = now()
  where game_id = game_id_input
    and (
      (group_id_input is not null and group_id = group_id_input)
      or (group_id_input is null and group_id is null and owner_id = current_user_id)
    )
  returning * into updated_row;

  if found then
    perform private.record_activity(
      current_user_id,
      updated_row.group_id,
      'vote',
      'game',
      updated_row.game_id,
      updated_row.title,
      jsonb_build_object(
        'vote', case when coalesce(vote_delta_input, 0) > 0 then 'like' else 'pass' end,
        'score', updated_row.score,
        'picks', updated_row.picks,
        'scope', case when updated_row.group_id is null then 'library' else 'clique' end,
        'poster', updated_row.poster,
        'backdrop', updated_row.backdrop,
        'overview', updated_row.overview
      )
    );
  end if;
end;
$$;

grant execute on function public.vote_movie(text, integer, uuid) to authenticated;
grant execute on function public.vote_series(text, integer, uuid) to authenticated;
grant execute on function public.vote_game(text, integer, uuid) to authenticated;
