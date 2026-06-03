-- Persist locked clique decisions so Tonight Mode can continue into done/rating follow-up.

create extension if not exists pgcrypto;

create table if not exists public.decision_sessions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  poll_id uuid references public.clique_polls(id) on delete set null,
  selected_option_id uuid references public.clique_poll_options(id) on delete set null,
  selected_label text not null check (length(trim(selected_label)) > 0 and length(selected_label) <= 160),
  item_type text not null default 'other' check (item_type in ('movie', 'series', 'game', 'video', 'music', 'other')),
  item_id text,
  status text not null default 'selected' check (status in ('selected', 'done', 'rated', 'cancelled')),
  selected_by uuid not null references auth.users(id) on delete cascade,
  selected_at timestamptz not null default now(),
  completed_by uuid references auth.users(id) on delete set null,
  completed_at timestamptz,
  rating numeric check (rating is null or (rating >= 0 and rating <= 10)),
  notes text
);

create unique index if not exists decision_sessions_poll_unique_idx
on public.decision_sessions(poll_id)
where poll_id is not null;

create index if not exists decision_sessions_group_selected_idx
on public.decision_sessions(group_id, selected_at desc);

alter table public.decision_sessions enable row level security;

drop policy if exists "Decision sessions visible to members" on public.decision_sessions;
drop policy if exists "Decision sessions insertable by members" on public.decision_sessions;
drop policy if exists "Decision sessions updateable by members" on public.decision_sessions;

create policy "Decision sessions visible to members"
on public.decision_sessions for select to authenticated
using (private.is_group_member(group_id, (select auth.uid())));

create policy "Decision sessions insertable by members"
on public.decision_sessions for insert to authenticated
with check (selected_by = (select auth.uid()) and private.is_group_member(group_id, (select auth.uid())));

create policy "Decision sessions updateable by members"
on public.decision_sessions for update to authenticated
using (private.is_group_member(group_id, (select auth.uid())))
with check (private.is_group_member(group_id, (select auth.uid())));

-- The earlier clique-polls migration created close_clique_poll(uuid) returning void.
-- Postgres requires dropping a function before changing its return type.
drop function if exists public.close_clique_poll(uuid);

create or replace function public.close_clique_poll(poll_id_input uuid)
returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare
  current_user_id uuid := auth.uid();
  target_poll public.clique_polls;
  winning_option_id uuid;
  winning_label text;
  winning_item_type text := 'other';
  winning_item_id text;
  winning_votes integer := 0;
  created_decision_id uuid;
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

  select
    o.id,
    o.label,
    coalesce(o.item_type, 'other'),
    o.item_id,
    count(v.voter_id)::integer
  into
    winning_option_id,
    winning_label,
    winning_item_type,
    winning_item_id,
    winning_votes
  from public.clique_poll_options o
  left join public.clique_poll_votes v on v.option_id = o.id
  where o.poll_id = poll_id_input
  group by o.id, o.label, o.item_type, o.item_id, o.created_at
  order by count(v.voter_id) desc, o.created_at asc
  limit 1;

  if winning_option_id is null then
    raise exception 'This poll has no options to select.';
  end if;

  update public.clique_polls
  set status = 'closed', closed_at = coalesce(closed_at, now())
  where id = poll_id_input;

  insert into public.decision_sessions (
    group_id,
    poll_id,
    selected_option_id,
    selected_label,
    item_type,
    item_id,
    selected_by
  )
  values (
    target_poll.group_id,
    target_poll.id,
    winning_option_id,
    winning_label,
    winning_item_type,
    winning_item_id,
    current_user_id
  )
  on conflict (poll_id) where poll_id is not null
  do update set
    selected_option_id = excluded.selected_option_id,
    selected_label = excluded.selected_label,
    item_type = excluded.item_type,
    item_id = excluded.item_id,
    selected_by = excluded.selected_by,
    selected_at = now(),
    status = 'selected'
  returning id into created_decision_id;

  perform private.record_activity(
    current_user_id,
    target_poll.group_id,
    'system',
    winning_item_type,
    created_decision_id::text,
    winning_label,
    jsonb_build_object(
      'pollId', target_poll.id,
      'decisionId', created_decision_id,
      'selectedLabel', winning_label,
      'votes', winning_votes,
      'kind', 'decision_locked'
    )
  );

  return created_decision_id;
end;
$$;

create or replace function public.get_clique_decisions(group_id_input uuid, limit_input integer default 10)
returns table(
  id uuid,
  group_id uuid,
  poll_id uuid,
  selected_option_id uuid,
  selected_label text,
  item_type text,
  item_id text,
  status text,
  selected_by uuid,
  selected_by_display_name text,
  selected_at timestamptz,
  completed_by uuid,
  completed_by_display_name text,
  completed_at timestamptz,
  rating numeric,
  notes text
)
language sql
stable
security definer
set search_path = public, private
as $$
  select
    d.id,
    d.group_id,
    d.poll_id,
    d.selected_option_id,
    d.selected_label,
    d.item_type,
    d.item_id,
    d.status,
    d.selected_by,
    coalesce(nullif(trim(selector.display_name), ''), split_part(coalesce(selector.email, ''), '@', 1), 'CliqueBase member') as selected_by_display_name,
    d.selected_at,
    d.completed_by,
    coalesce(nullif(trim(completer.display_name), ''), split_part(coalesce(completer.email, ''), '@', 1), null) as completed_by_display_name,
    d.completed_at,
    d.rating,
    d.notes
  from public.decision_sessions d
  left join public.profiles selector on selector.id = d.selected_by
  left join public.profiles completer on completer.id = d.completed_by
  where d.group_id = group_id_input
    and private.is_group_member(d.group_id, auth.uid())
  order by d.selected_at desc
  limit greatest(1, least(coalesce(limit_input, 10), 50));
$$;

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

  update public.decision_sessions
  set
    status = case when rating_input is null then 'done' else 'rated' end,
    completed_by = current_user_id,
    completed_at = now(),
    rating = rating_input,
    notes = nullif(trim(coalesce(notes_input, '')), '')
  where id = decision_id_input;

  perform private.record_activity(
    current_user_id,
    target_decision.group_id,
    'rating',
    target_decision.item_type,
    target_decision.id::text,
    target_decision.selected_label,
    jsonb_build_object(
      'decisionId', target_decision.id,
      'rating', rating_input,
      'notes', nullif(trim(coalesce(notes_input, '')), ''),
      'kind', 'decision_done'
    )
  );
end;
$$;

grant execute on function public.close_clique_poll(uuid) to authenticated;
grant execute on function public.get_clique_decisions(uuid, integer) to authenticated;
grant execute on function public.mark_decision_done(uuid, numeric, text) to authenticated;
