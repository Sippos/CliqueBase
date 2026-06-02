-- Let users inspect and undo their block list.
-- This is intentionally self-contained so it can be run after either the full
-- safety migration or the feed block-filter migration.
--
-- Keep avatar_url as a nullable return field for frontend compatibility, but do
-- not read public.profiles.avatar_url because older CliqueBase schemas do not
-- define that column.

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

create or replace function public.get_blocked_users()
returns table(
  user_id uuid,
  display_name text,
  email text,
  avatar_url text,
  blocked_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    b.blocked_id as user_id,
    coalesce(nullif(trim(p.display_name), ''), split_part(coalesce(p.email, ''), '@', 1), 'CliqueBase member') as display_name,
    p.email,
    null::text as avatar_url,
    b.created_at as blocked_at
  from public.user_blocks b
  left join public.profiles p on p.id = b.blocked_id
  where b.blocker_id = auth.uid()
  order by b.created_at desc;
$$;

grant execute on function public.get_blocked_users() to authenticated;
