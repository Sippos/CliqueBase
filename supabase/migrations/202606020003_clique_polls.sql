-- Lightweight clique polls for Tonight Mode / group decisions.

create table if not exists public.clique_polls (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  creator_id uuid not null references auth.users(id) on delete cascade,
  question text not null check (length(trim(question)) > 0 and length(question) <= 240),
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  closes_at timestamptz,
  closed_at timestamptz
);

create table if not exists public.clique_poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.clique_polls(id) on delete cascade,
  label text not null check (length(trim(label)) > 0 and length(label) <= 160),
  item_type text check (item_type in ('movie', 'series', 'game', 'video', 'music', 'other')),
  item_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.clique_poll_votes (
  poll_id uuid not null references public.clique_polls(id) on delete cascade,
  option_id uuid not null references public.clique_poll_options(id) on delete cascade,
  voter_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (poll_id, voter_id)
);

create index if not exists clique_polls_group_created_idx on public.clique_polls(group_id, created_at desc);
create index if not exists clique_poll_options_poll_idx on public.clique_poll_options(poll_id);
create index if not exists clique_poll_votes_option_idx on public.clique_poll_votes(option_id);

alter table public.clique_polls enable row level security;
alter table public.clique_poll_options enable row level security;
alter table public.clique_poll_votes enable row level security;

drop policy if exists "Clique polls visible to members" on public.clique_polls;
drop policy if exists "Clique polls insertable by members" on public.clique_polls;
drop policy if exists "Clique polls updateable by creator or moderators" on public.clique_polls;

create policy "Clique polls visible to members"
on public.clique_polls for select to authenticated
using (private.is_group_member(group_id, (select auth.uid())));

create policy "Clique polls insertable by members"
on public.clique_polls for insert to authenticated
with check (creator_id = (select auth.uid()) and private.is_group_member(group_id, (select auth.uid())));

create policy "Clique polls updateable by creator or moderators"
on public.clique_polls for update to authenticated
using (creator_id = (select auth.uid()) or private.can_moderate_group_content(group_id, (select auth.uid())))
with check (creator_id = (select auth.uid()) or private.can_moderate_group_content(group_id, (select auth.uid())));

drop policy if exists "Clique poll options visible to members" on public.clique_poll_options;
drop policy if exists "Clique poll options insertable by poll creator" on public.clique_poll_options;

create policy "Clique poll options visible to members"
on public.clique_poll_options for select to authenticated
using (
  exists (
    select 1 from public.clique_polls p
    where p.id = poll_id and private.is_group_member(p.group_id, (select auth.uid()))
  )
);

create policy "Clique poll options insertable by poll creator"
on public.clique_poll_options for insert to authenticated
with check (
  exists (
    select 1 from public.clique_polls p
    where p.id = poll_id and p.creator_id = (select auth.uid()) and private.is_group_member(p.group_id, (select auth.uid()))
  )
);

drop policy if exists "Clique poll votes visible to members" on public.clique_poll_votes;
drop policy if exists "Clique poll votes insertable by members" on public.clique_poll_votes;
drop policy if exists "Clique poll votes updateable by voter" on public.clique_poll_votes;

create policy "Clique poll votes visible to members"
on public.clique_poll_votes for select to authenticated
using (
  exists (
    select 1 from public.clique_polls p
    where p.id = poll_id and private.is_group_member(p.group_id, (select auth.uid()))
  )
);

create policy "Clique poll votes insertable by members"
on public.clique_poll_votes for insert to authenticated
with check (
  voter_id = (select auth.uid())
  and exists (
    select 1 from public.clique_polls p
    where p.id = poll_id and p.status = 'open' and private.is_group_member(p.group_id, (select auth.uid()))
  )
  and exists (
    select 1 from public.clique_poll_options o
    where o.id = option_id and o.poll_id = clique_poll_votes.poll_id
  )
);

create policy "Clique poll votes updateable by voter"
on public.clique_poll_votes for update to authenticated
using (voter_id = (select auth.uid()))
with check (voter_id = (select auth.uid()));

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

  select array_agg(distinct trim(option_value)) into clean_options
  from unnest(coalesce(options_input, '{}')) as option_value
  where length(trim(option_value)) > 0;

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
  where id = poll_id_input and status = 'open';

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

create or replace function public.close_clique_poll(poll_id_input uuid)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  current_user_id uuid := auth.uid();
  target_poll public.clique_polls;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to close a poll.';
  end if;

  select * into target_poll from public.clique_polls where id = poll_id_input;
  if target_poll.id is null then
    raise exception 'Poll not found.';
  end if;

  if target_poll.creator_id <> current_user_id and not private.can_moderate_group_content(target_poll.group_id, current_user_id) then
    raise exception 'Only the creator or a moderator can close this poll.';
  end if;

  update public.clique_polls
  set status = 'closed', closed_at = now()
  where id = poll_id_input;
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
    p.status,
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

grant execute on function public.create_clique_poll(uuid, text, text[]) to authenticated;
grant execute on function public.vote_clique_poll(uuid, uuid) to authenticated;
grant execute on function public.close_clique_poll(uuid) to authenticated;
grant execute on function public.get_clique_polls(uuid, integer) to authenticated;
