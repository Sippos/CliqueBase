-- Make blocking a stronger safety action.
-- When a user blocks another member, remove any existing friendship edge in both
-- directions and cancel pending friend requests between the two users.

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

create or replace function public.block_user(blocked_id_input uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'You must be signed in to block someone.';
  end if;
  if blocked_id_input is null or blocked_id_input = current_user_id then
    raise exception 'Choose another member to block.';
  end if;

  insert into public.user_blocks (blocker_id, blocked_id)
  values (current_user_id, blocked_id_input)
  on conflict do nothing;

  delete from public.user_friends
  where (user_id = current_user_id and friend_id = blocked_id_input)
     or (user_id = blocked_id_input and friend_id = current_user_id);

  update public.friend_requests
  set status = 'cancelled',
      updated_at = now()
  where status = 'pending'
    and (
      (requester_id = current_user_id and addressee_id = blocked_id_input)
      or (requester_id = blocked_id_input and addressee_id = current_user_id)
    );
end;
$$;

grant execute on function public.block_user(uuid) to authenticated;
