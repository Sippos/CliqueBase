-- Prevent friend requests between users who have blocked each other.
-- This hardens the social request flow now that user_blocks powers feed safety.

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

create or replace function public.send_friend_request(friend_id_input uuid)
returns public.friend_requests
language plpgsql
security definer
set search_path = public, private
as $$
declare
  current_user_id uuid := auth.uid();
  existing_request public.friend_requests;
  created_request public.friend_requests;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to add friends.';
  end if;

  if friend_id_input is null or friend_id_input = current_user_id then
    raise exception 'Choose another member to add.';
  end if;

  if exists (
    select 1
    from public.user_blocks b
    where (b.blocker_id = current_user_id and b.blocked_id = friend_id_input)
       or (b.blocker_id = friend_id_input and b.blocked_id = current_user_id)
  ) then
    raise exception 'Friend requests are unavailable between blocked members.';
  end if;

  if not exists (select 1 from public.profiles p where p.id = friend_id_input) then
    raise exception 'No member found for that profile.';
  end if;

  if exists (
    select 1
    from public.user_friends uf
    where uf.user_id = current_user_id
      and uf.friend_id = friend_id_input
  ) then
    select *
    into created_request
    from public.friend_requests fr
    where ((fr.requester_id = current_user_id and fr.addressee_id = friend_id_input)
       or (fr.requester_id = friend_id_input and fr.addressee_id = current_user_id))
      and fr.status = 'accepted'
    order by fr.responded_at desc nulls last, fr.created_at desc
    limit 1;

    if created_request.id is not null then
      return created_request;
    end if;
  end if;

  select *
  into existing_request
  from public.friend_requests fr
  where fr.requester_id = current_user_id
    and fr.addressee_id = friend_id_input
    and fr.status = 'pending'
  limit 1;

  if existing_request.id is not null then
    return existing_request;
  end if;

  select *
  into existing_request
  from public.friend_requests fr
  where fr.requester_id = friend_id_input
    and fr.addressee_id = current_user_id
    and fr.status = 'pending'
  limit 1;

  if existing_request.id is not null then
    update public.friend_requests
    set status = 'accepted',
        updated_at = now(),
        responded_at = now()
    where id = existing_request.id
    returning * into created_request;

    insert into public.user_friends (user_id, friend_id)
    values (current_user_id, friend_id_input), (friend_id_input, current_user_id)
    on conflict (user_id, friend_id) do nothing;

    perform private.create_notification(
      friend_id_input,
      current_user_id,
      'friend_accept',
      'profile',
      current_user_id::text,
      jsonb_build_object('memberId', current_user_id)
    );

    return created_request;
  end if;

  insert into public.friend_requests (requester_id, addressee_id)
  values (current_user_id, friend_id_input)
  returning * into created_request;

  perform private.create_notification(
    friend_id_input,
    current_user_id,
    'friend_request',
    'friend_request',
    created_request.id::text,
    jsonb_build_object('requestId', created_request.id)
  );

  return created_request;
end;
$$;

grant execute on function public.send_friend_request(uuid) to authenticated;
