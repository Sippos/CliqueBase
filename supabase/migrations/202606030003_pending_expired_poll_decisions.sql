-- Surface expired polls that still need to be locked into decisions.

create or replace function public.get_pending_expired_poll_decisions(group_id_input uuid, limit_input integer default 5)
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
    'closed'::text as status,
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
    and p.status = 'open'
    and p.closes_at is not null
    and p.closes_at <= now()
    and private.is_group_member(p.group_id, auth.uid())
    and not exists (
      select 1
      from public.decision_sessions d
      where d.poll_id = p.id
    )
  group by p.id, pr.display_name, pr.email, my_vote.option_id
  order by p.closes_at desc, p.created_at desc
  limit greatest(1, least(coalesce(limit_input, 5), 25));
$$;

grant execute on function public.get_pending_expired_poll_decisions(uuid, integer) to authenticated;
