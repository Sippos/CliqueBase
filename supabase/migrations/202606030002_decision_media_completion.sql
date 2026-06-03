-- When a locked decision is marked done, sync completion back to the matching media row when possible.

create or replace function public.mark_decision_done(
  decision_id_input uuid,
  rating_input numeric default null,
  notes_input text default null
)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  current_user_id uuid := auth.uid();
  target_decision public.decision_sessions;
  rounded_rating integer := null;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to mark a decision done.';
  end if;

  select * into target_decision from public.decision_sessions where id = decision_id_input;
  if target_decision.id is null then
    raise exception 'Decision not found.';
  end if;

  if not private.is_group_member(target_decision.group_id, current_user_id) then
    raise exception 'This decision is not available to you.';
  end if;

  if rating_input is not null and (rating_input < 0 or rating_input > 10) then
    raise exception 'Rating must be between 0 and 10.';
  end if;

  if rating_input is not null and rating_input >= 1 then
    rounded_rating := least(10, greatest(1, round(rating_input)::integer));
  end if;

  update public.decision_sessions
  set
    status = case when rating_input is null then 'done' else 'rated' end,
    completed_by = current_user_id,
    completed_at = now(),
    rating = rating_input,
    notes = nullif(trim(coalesce(notes_input, '')), '')
  where id = decision_id_input;

  if nullif(trim(coalesce(target_decision.item_id, '')), '') is not null then
    if target_decision.item_type = 'movie' then
      update public.movies
      set
        watched = true,
        my_rating = coalesce(rounded_rating, my_rating),
        updated_at = now()
      where movie_id = target_decision.item_id
        and (
          group_id = target_decision.group_id
          or (group_id is null and owner_id = current_user_id)
        );
    elsif target_decision.item_type = 'series' then
      update public.series
      set
        finished = true,
        my_rating = coalesce(rounded_rating, my_rating),
        updated_at = now()
      where series_id = target_decision.item_id
        and (
          group_id = target_decision.group_id
          or (group_id is null and owner_id = current_user_id)
        );
    elsif target_decision.item_type = 'game' then
      update public.games
      set
        played = true,
        my_rating = coalesce(rounded_rating, my_rating),
        updated_at = now()
      where game_id = target_decision.item_id
        and (
          group_id = target_decision.group_id
          or (group_id is null and owner_id = current_user_id)
        );
    end if;
  end if;

  perform private.record_activity(
    current_user_id,
    target_decision.group_id,
    'rating',
    target_decision.item_type,
    target_decision.id::text,
    target_decision.selected_label,
    jsonb_build_object(
      'decisionId', target_decision.id,
      'itemType', target_decision.item_type,
      'itemId', target_decision.item_id,
      'rating', rating_input,
      'notes', nullif(trim(coalesce(notes_input, '')), ''),
      'kind', 'decision_done'
    )
  );
end;
$$;

grant execute on function public.mark_decision_done(uuid, numeric, text) to authenticated;
