-- Cross-device sync for Swipe Deck votes

create table if not exists public.user_media_votes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  group_id uuid references public.groups(id) on delete cascade,
  media_type text not null check (media_type in ('movie', 'series', 'game', 'video')),
  media_id text not null,
  vote text not null check (vote in ('like', 'pass')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists user_media_votes_unique_idx on public.user_media_votes(user_id, media_type, media_id, coalesce(group_id, '00000000-0000-0000-0000-000000000000'::uuid));

alter table public.user_media_votes enable row level security;

create policy "Users can view their own votes"
  on public.user_media_votes for select
  using (auth.uid() = user_id);

create policy "Users can insert their own votes"
  on public.user_media_votes for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own votes"
  on public.user_media_votes for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.get_user_votes(media_type_input text, group_id_input uuid default null)
returns table(media_id text, vote text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;

  return query
  select umv.media_id, umv.vote
  from public.user_media_votes umv
  where umv.user_id = auth.uid()
    and umv.media_type = media_type_input
    and (
      (group_id_input is not null and umv.group_id = group_id_input)
      or (group_id_input is null and umv.group_id is null)
    );
end;
$$;
grant execute on function public.get_user_votes(text, uuid) to authenticated;

create or replace function public.vote_movie(movie_id_input text, vote_delta_input integer, group_id_input uuid default null)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  current_user_id uuid := auth.uid();
  updated_row public.movies;
  vote_val text := case when coalesce(vote_delta_input, 0) > 0 then 'like' else 'pass' end;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to vote.';
  end if;

  if group_id_input is not null and not private.is_group_member(group_id_input, current_user_id) then
    raise exception 'You must be a member of this group to vote.';
  end if;

  insert into public.user_media_votes (user_id, group_id, media_type, media_id, vote)
  values (current_user_id, group_id_input, 'movie', movie_id_input, vote_val)
  on conflict (user_id, media_type, media_id, coalesce(group_id, '00000000-0000-0000-0000-000000000000'::uuid))
  do update set vote = excluded.vote, updated_at = now();

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
        'vote', vote_val,
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

create or replace function public.vote_series(series_id_input text, vote_delta_input integer, group_id_input uuid default null)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  current_user_id uuid := auth.uid();
  updated_row public.series;
  vote_val text := case when coalesce(vote_delta_input, 0) > 0 then 'like' else 'pass' end;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to vote.';
  end if;

  if group_id_input is not null and not private.is_group_member(group_id_input, current_user_id) then
    raise exception 'You must be a member of this group to vote.';
  end if;

  insert into public.user_media_votes (user_id, group_id, media_type, media_id, vote)
  values (current_user_id, group_id_input, 'series', series_id_input, vote_val)
  on conflict (user_id, media_type, media_id, coalesce(group_id, '00000000-0000-0000-0000-000000000000'::uuid))
  do update set vote = excluded.vote, updated_at = now();

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
        'vote', vote_val,
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
grant execute on function public.vote_series(text, integer, uuid) to authenticated;

create or replace function public.vote_game(game_id_input text, vote_delta_input integer, group_id_input uuid default null)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  current_user_id uuid := auth.uid();
  updated_row public.games;
  vote_val text := case when coalesce(vote_delta_input, 0) > 0 then 'like' else 'pass' end;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to vote.';
  end if;

  if group_id_input is not null and not private.is_group_member(group_id_input, current_user_id) then
    raise exception 'You must be a member of this group to vote.';
  end if;

  insert into public.user_media_votes (user_id, group_id, media_type, media_id, vote)
  values (current_user_id, group_id_input, 'game', game_id_input, vote_val)
  on conflict (user_id, media_type, media_id, coalesce(group_id, '00000000-0000-0000-0000-000000000000'::uuid))
  do update set vote = excluded.vote, updated_at = now();

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
        'vote', vote_val,
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
grant execute on function public.vote_game(text, integer, uuid) to authenticated;

create or replace function public.vote_video(video_id_input text, vote_delta_input integer, group_id_input uuid default null)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  current_user_id uuid := auth.uid();
  updated_row public.videos;
  vote_val text := case when coalesce(vote_delta_input, 0) > 0 then 'like' else 'pass' end;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to vote.';
  end if;

  if group_id_input is not null and not private.is_group_member(group_id_input, current_user_id) then
    raise exception 'You must be a member of this group to vote.';
  end if;

  insert into public.user_media_votes (user_id, group_id, media_type, media_id, vote)
  values (current_user_id, group_id_input, 'video', video_id_input, vote_val)
  on conflict (user_id, media_type, media_id, coalesce(group_id, '00000000-0000-0000-0000-000000000000'::uuid))
  do update set vote = excluded.vote, updated_at = now();

  update public.videos
  set picks = greatest(0, coalesce(picks, 0) + 1),
      score = coalesce(score, 0) + coalesce(vote_delta_input, 0),
      updated_at = now()
  where video_id = video_id_input
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
      'video',
      updated_row.video_id,
      updated_row.title,
      jsonb_build_object(
        'vote', vote_val,
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
grant execute on function public.vote_video(text, integer, uuid) to authenticated;
