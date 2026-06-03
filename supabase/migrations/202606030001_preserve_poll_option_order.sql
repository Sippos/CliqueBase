-- Preserve the order users type poll options while still removing duplicate labels.

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
  option_label text;
  clean_options text[];
begin
  if current_user_id is null then
    raise exception 'You must be signed in to create a poll.';
  end if;

  if group_id_input is null or not private.is_group_member(group_id_input, current_user_id) then
    raise exception 'Choose a clique you belong to.';
  end if;

  select array_agg(clean_option order by first_seen) into clean_options
  from (
    select lower(trim(option_value)) as option_key, min(option_order) as first_seen, min(trim(option_value)) as clean_option
    from unnest(coalesce(options_input, '{}')) with ordinality as raw_options(option_value, option_order)
    where length(trim(option_value)) > 0
    group by lower(trim(option_value))
  ) ordered_options;

  if array_length(clean_options, 1) < 2 then
    raise exception 'Add at least two poll options.';
  end if;

  insert into public.clique_polls (group_id, creator_id, question, closes_at)
  values (group_id_input, current_user_id, trim(question_input), now() + interval '1 day')
  returning id into created_poll_id;

  foreach option_label in array clean_options loop
    insert into public.clique_poll_options (poll_id, label, item_type)
    values (created_poll_id, left(option_label, 160), 'other');
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
