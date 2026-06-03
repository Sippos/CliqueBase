-- Dedupe structured Tonight Mode options by media identity, not display label.
-- Example: [movie:123] Dune and [movie:123] Dune: Part Two should become one option.

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
    select
      trim(option_value) as raw_label,
      option_order,
      regexp_match(trim(option_value), '^\[(movie|series|game|video|music|other):([^\]]+)\]\s*(.+)$') as match
    from unnest(coalesce(options_input, '{}')) with ordinality as raw_options(option_value, option_order)
    where length(trim(option_value)) > 0
  ), parsed as (
    select
      raw_label,
      option_order,
      case when match is null then 'other' else match[1] end as item_type,
      case when match is null then null else nullif(trim(match[2]), '') end as item_id,
      case when match is null then raw_label else trim(match[3]) end as display_label,
      case when match is null then lower(raw_label) else concat(match[1], ':', nullif(trim(match[2]), '')) end as dedupe_key
    from normalized
  ), deduped as (
    select distinct on (dedupe_key)
      item_type,
      item_id,
      display_label,
      option_order
    from parsed
    where dedupe_key is not null and length(trim(display_label)) > 0
    order by dedupe_key, option_order
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
      select
        trim(option_value) as raw_label,
        option_order,
        regexp_match(trim(option_value), '^\[(movie|series|game|video|music|other):([^\]]+)\]\s*(.+)$') as match
      from unnest(coalesce(options_input, '{}')) with ordinality as raw_options(option_value, option_order)
      where length(trim(option_value)) > 0
    ), parsed as (
      select
        raw_label,
        option_order,
        case when match is null then 'other' else match[1] end as item_type,
        case when match is null then null else nullif(trim(match[2]), '') end as item_id,
        case when match is null then raw_label else trim(match[3]) end as display_label,
        case when match is null then lower(raw_label) else concat(match[1], ':', nullif(trim(match[2]), '')) end as dedupe_key
      from normalized
    ), deduped as (
      select distinct on (dedupe_key)
        item_type,
        item_id,
        display_label,
        option_order
      from parsed
      where dedupe_key is not null and length(trim(display_label)) > 0
      order by dedupe_key, option_order
    )
    select item_type, item_id, display_label
    from deduped
    order by option_order
    limit 8
  loop
    option_item_type := coalesce(option_row.item_type, 'other');
    option_item_id := option_row.item_id;
    option_display_label := option_row.display_label;

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
