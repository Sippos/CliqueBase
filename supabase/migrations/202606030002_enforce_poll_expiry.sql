-- Treat polls past closes_at as closed and reject late votes.

create or replace function public.vote_clique_poll(poll_id_input uuid, option_id_input uuid)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  current_user_id uuid := auth.uid();
  poll_group_id uuid;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to vote.';
  end if;

  select group_id into poll_group_id
  from public.clique_polls
  where id = poll_id_input
    and status = 'open'
    and (closes_at is null or closes_at > now());

  if poll_group_id is null or not private.is_group_member(poll_group_id, current_user_id) then
    raise exception 'This poll is not open to you.';
  end if;

  if not exists (select 1 from public.clique_poll_options where id = option_id_input and poll_id = poll_id_input) then
    raise exception 'Choose a valid poll option.';
  end if;

  insert into public.clique_poll_votes (poll_id, option_id, voter_id)
  values (poll_id_input, option_id_input, current_user_id)
  on conflict (poll_id, voter_id)
  do update set option_id = excluded.option_id, created_at = now();
end;
$$;

create or replace function public.get_clique_polls(group_id_input uuid, limit_input integer default 10)
returns table(
  id uuid,
  group_id uuid,
  question text,
  status text,
  creator_id uuid,
  creator_display_name text,
  created_at timestamptz,
  closes_at timestamptz,
  my_option_id uuid,
  options jsonb
)
language sql
stable
security definer
set search_path = public, private
as $$
  select
    p.id,
    p.group_id,
    p.question,
    case when p.status = 'open' and p.closes_at is not null and p.closes_at <= now() then 'closed' else p.status end as status,
    p.creator_id,
    coalesce(nullif(trim(pr.display_name), ''), split_part(coalesce(pr.email, ''), '@', 1), 'CliqueBase member') as creator_display_name,
    p.created_at,
    p.closes_at,
    my_vote.option_id as my_option_id,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', o.id,
          'label', o.label,
          'itemType', o.item_type,
          'itemId', o.item_id,
          'votes', coalesce(v.vote_count, 0)
        ) order by o.created_at asc
      ) filter (where o.id is not null),
      '[]'::jsonb
    ) as options
  from public.clique_polls p
  left join public.profiles pr on pr.id = p.creator_id
  left join public.clique_poll_options o on o.poll_id = p.id
  left join (
    select option_id, count(*)::integer as vote_count
    from public.clique_poll_votes
    group by option_id
  ) v on v.option_id = o.id
  left join public.clique_poll_votes my_vote on my_vote.poll_id = p.id and my_vote.voter_id = auth.uid()
  where p.group_id = group_id_input
    and private.is_group_member(p.group_id, auth.uid())
  group by p.id, pr.display_name, pr.email, my_vote.option_id
  order by p.created_at desc
  limit greatest(1, least(coalesce(limit_input, 10), 50));
$$;

grant execute on function public.vote_clique_poll(uuid, uuid) to authenticated;
grant execute on function public.get_clique_polls(uuid, integer) to authenticated;
