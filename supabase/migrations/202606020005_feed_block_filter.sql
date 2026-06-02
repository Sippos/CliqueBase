-- Make user blocks affect the social feed.
-- Replaces the community feed RPC so blocked actors disappear from the caller's feed,
-- and actors who blocked the caller are also hidden.
--
-- This migration defensively creates public.user_blocks because this RPC is often
-- tested manually after copying only this file. The full safety migration still
-- owns the report/block functions and policies.

create table if not exists public.user_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index if not exists user_blocks_blocked_idx on public.user_blocks(blocked_id);

alter table public.user_blocks enable row level security;

drop policy if exists "Users can read their own blocks" on public.user_blocks;
drop policy if exists "Users can create their own blocks" on public.user_blocks;
drop policy if exists "Users can delete their own blocks" on public.user_blocks;

create policy "Users can read their own blocks"
on public.user_blocks for select to authenticated
using (blocker_id = (select auth.uid()));

create policy "Users can create their own blocks"
on public.user_blocks for insert to authenticated
with check (blocker_id = (select auth.uid()) and blocker_id <> blocked_id);

create policy "Users can delete their own blocks"
on public.user_blocks for delete to authenticated
using (blocker_id = (select auth.uid()));

create or replace function public.get_social_activity(limit_input integer default 40, include_public_input boolean default true)
returns table(
  id uuid,
  type text,
  actor_id uuid,
  actor_display_name text,
  group_id uuid,
  group_name text,
  item_type text,
  item_id text,
  title text,
  payload jsonb,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public, private
as $$
  select
    ae.id,
    ae.type,
    ae.actor_id,
    coalesce(nullif(trim(p.display_name), ''), split_part(coalesce(p.email, ''), '@', 1), 'CliqueBase member') as actor_display_name,
    ae.group_id,
    g.name as group_name,
    ae.item_type,
    ae.item_id,
    ae.title,
    ae.payload,
    ae.created_at
  from public.activity_events ae
  left join public.profiles p on p.id = ae.actor_id
  left join public.groups g on g.id = ae.group_id
  where auth.uid() is not null
    and not exists (
      select 1
      from public.user_blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = ae.actor_id)
         or (b.blocker_id = ae.actor_id and b.blocked_id = auth.uid())
    )
    and (
      ae.actor_id = auth.uid()
      or ae.group_id is null
      or private.is_group_member(ae.group_id, auth.uid())
      or (include_public_input and coalesce(g.is_public, false))
    )
  order by ae.created_at desc
  limit greatest(1, least(coalesce(limit_input, 40), 100));
$$;

grant execute on function public.get_social_activity(integer, boolean) to authenticated;
