-- Preserve option order when creating Tonight Mode polls.
-- Earlier versions used array_agg(distinct ...), which can scramble option order.

create or replace function public.create_clique_poll(
  group_id_input uuid,
  question_input text,
  options_input text[]
)
returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare
  current_user_id uuid := auth.uid();
  created_poll_id uuid;
  option_row record;
  option_match text[];
  option_item_type text;
  option_item_id text;
  option_display_label text;
  clean_option_count integer;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to create a poll.';
  end if;

  if group_id_input is null or not private.is_group_member(group_id_input, current_user_id) then
    raise exception 'Choose a clique you belong to.';
  end if;

  with normalized as (
    select trim(option_value) as label, option_order
    from unnest(coalesce(options_input, '{}')) with ordinality as raw_options(option_value, option_order)
    where length(trim(option_value)) > 0
  ), deduped as (
    select distinct on (lower(label)) label, option_order
    from normalized
    order by lower(label), option_order
  )
  select count(*) into clean_option_count
  from deduped;

  if clean_option_count < 2 then
    raise exception 'Add at least two poll options.';
  end if;

  insert into public.clique_polls (group_id, creator_id, question, closes_at)
  values (group_id_input, current_user_id, trim(question_input), now() + interval '1 day')
  returning id into created_poll_id;

  for option_row in
    with normalized as (
      select trim(option_value) as label, option_order
      from unnest(coalesce(options_input, '{}')) with ordinality as raw_options(option_value, option_order)
      where length(trim(option_value)) > 0
    ), deduped as (
      select distinct on (lower(label)) label, option_order
      from normalized
      order by lower(label), option_order
    )
    select label
    from deduped
    order by option_order
    limit 8
  loop
    option_match := regexp_match(option_row.label, '^\[(movie|series|game|video|music|other):([^\]]+)\]\s*(.+)$');

    if option_match is not null then
      option_item_type := option_match[1];
      option_item_id := nullif(trim(option_match[2]), '');
      option_display_label := trim(option_match[3]);
    else
      option_item_type := 'other';
      option_item_id := null;
      option_display_label := option_row.label;
    end if;

    insert into public.clique_poll_options (poll_id, label, item_type, item_id)
    values (created_poll_id, left(option_display_label, 160), option_item_type, option_item_id);
  end loop;

  perform private.record_activity(
    current_user_id,
    group_id_input,
    'system',
    'other',
    created_poll_id::text,
    trim(question_input),
    jsonb_build_object('pollId', created_poll_id, 'kind', 'poll_created')
  );

  return created_poll_id;
end;
$$;

grant execute on function public.create_clique_poll(uuid, text, text[]) to authenticated;
