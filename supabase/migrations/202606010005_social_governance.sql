-- Social governance, clique permissions, friend requests, and notifications.
-- Run after 202606010004_video_delete_policy.sql.
--
-- Design intent:
-- - Keep existing member add/vote flows working.
-- - Move destructive and governance actions behind explicit SQL permissions.
-- - Add request-based social relationships and a notification inbox for UX.

create extension if not exists pgcrypto;

-- Roles: owner > admin > moderator > member.
do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select c.conname
    from pg_constraint c
    where c.conrelid = 'public.group_members'::regclass
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%role%'
  loop
    execute format('alter table public.group_members drop constraint %I', constraint_name);
  end loop;
end $$;

alter table public.group_members
  add constraint group_members_role_check
  check (role in ('owner', 'admin', 'moderator', 'member'));

update public.group_members gm
set role = 'owner'
from public.groups g
where g.id = gm.group_id
  and g.owner_id = gm.user_id
  and gm.role <> 'owner';

create index if not exists group_members_group_role_idx on public.group_members(group_id, role);

create or replace function private.group_role_rank(role_input text)
returns integer
language sql
immutable
as $$
  select case coalesce(role_input, '')
    when 'owner' then 100
    when 'admin' then 80
    when 'moderator' then 60
    when 'member' then 10
    else 0
  end;
$$;

create or replace function private.get_group_role(target_group_id uuid, target_user_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select gm.role
  from public.group_members gm
  where gm.group_id = target_group_id
    and gm.user_id = target_user_id
  limit 1;
$$;

create or replace function private.has_group_role(target_group_id uuid, target_user_id uuid, required_role text)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select target_user_id is not null
    and private.group_role_rank(private.get_group_role(target_group_id, target_user_id)) >= private.group_role_rank(required_role);
$$;

create or replace function private.can_manage_group(target_group_id uuid, target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select private.has_group_role(target_group_id, target_user_id, 'admin');
$$;

create or replace function private.can_moderate_group_content(target_group_id uuid, target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select private.has_group_role(target_group_id, target_user_id, 'moderator');
$$;

create or replace function private.can_manage_group_member(target_group_id uuid, actor_id uuid, target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  with roles as (
    select
      private.group_role_rank(private.get_group_role(target_group_id, actor_id)) as actor_rank,
      private.group_role_rank(private.get_group_role(target_group_id, target_user_id)) as target_rank
  )
  select actor_id is not null
    and target_user_id is not null
    and actor_id <> target_user_id
    and actor_rank >= private.group_role_rank('admin')
    and actor_rank > target_rank
  from roles;
$$;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  type text not null check (type in (
    'friend_request',
    'friend_accept',
    'media_share',
    'clique_invite',
    'clique_join',
    'member_removed',
    'role_changed',
    'clique_deleted',
    'system'
  )),
  entity_type text,
  entity_id text,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_recipient_created_idx on public.notifications(recipient_id, created_at desc);
create index if not exists notifications_recipient_read_idx on public.notifications(recipient_id, read_at) where read_at is null;

alter table public.notifications enable row level security;

drop policy if exists "Notifications are readable by recipient" on public.notifications;
drop policy if exists "Notifications are insertable by recipient" on public.notifications;
drop policy if exists "Notifications are updatable by recipient" on public.notifications;
drop policy if exists "Notifications are deletable by recipient" on public.notifications;

create policy "Notifications are readable by recipient" on public.notifications
for select to authenticated
using (recipient_id = (select auth.uid()));

-- The app writes notifications through private.create_notification(). This direct insert policy
-- only permits a user to create a local/self notification and prevents cross-user spoofing.
create policy "Notifications are insertable by recipient" on public.notifications
for insert to authenticated
with check (recipient_id = (select auth.uid()) and (actor_id is null or actor_id = (select auth.uid())));

create policy "Notifications are updatable by recipient" on public.notifications
for update to authenticated
using (recipient_id = (select auth.uid()))
with check (recipient_id = (select auth.uid()));

create policy "Notifications are deletable by recipient" on public.notifications
for delete to authenticated
using (recipient_id = (select auth.uid()));

create or replace function private.create_notification(
  recipient_id_input uuid,
  actor_id_input uuid,
  type_input text,
  entity_type_input text default null,
  entity_id_input text default null,
  payload_input jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if recipient_id_input is null then
    return;
  end if;

  if actor_id_input is not null and actor_id_input = recipient_id_input then
    return;
  end if;

  insert into public.notifications (recipient_id, actor_id, type, entity_type, entity_id, payload)
  values (
    recipient_id_input,
    actor_id_input,
    type_input,
    entity_type_input,
    entity_id_input,
    coalesce(payload_input, '{}'::jsonb)
  );
end;
$$;

create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  addressee_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  responded_at timestamptz,
  check (requester_id <> addressee_id)
);

create index if not exists friend_requests_addressee_status_idx on public.friend_requests(addressee_id, status, created_at desc);
create index if not exists friend_requests_requester_status_idx on public.friend_requests(requester_id, status, created_at desc);
create unique index if not exists friend_requests_one_pending_pair_idx
  on public.friend_requests(least(requester_id, addressee_id), greatest(requester_id, addressee_id))
  where status = 'pending';

alter table public.friend_requests enable row level security;

drop policy if exists "Friend requests are readable by participants" on public.friend_requests;
drop policy if exists "Friend requests are insertable by requester" on public.friend_requests;
drop policy if exists "Friend requests are cancellable by requester" on public.friend_requests;
drop policy if exists "Friend requests are answerable by addressee" on public.friend_requests;
drop policy if exists "Friend requests are updatable by participants" on public.friend_requests;

create policy "Friend requests are readable by participants" on public.friend_requests
for select to authenticated
using (requester_id = (select auth.uid()) or addressee_id = (select auth.uid()));

create policy "Friend requests are insertable by requester" on public.friend_requests
for insert to authenticated
with check (requester_id = (select auth.uid()) and status = 'pending');

create policy "Friend requests are cancellable by requester" on public.friend_requests
for update to authenticated
using (requester_id = (select auth.uid()) and status = 'pending')
with check (requester_id = (select auth.uid()) and status = 'cancelled');

create policy "Friend requests are answerable by addressee" on public.friend_requests
for update to authenticated
using (addressee_id = (select auth.uid()) and status = 'pending')
with check (addressee_id = (select auth.uid()) and status in ('accepted', 'declined'));

create or replace function public.get_group_permissions(group_id_input uuid)
returns table(
  group_id uuid,
  user_id uuid,
  role text,
  can_update_settings boolean,
  can_manage_members boolean,
  can_moderate_content boolean,
  can_delete_group boolean,
  can_transfer_ownership boolean
)
language sql
stable
security definer
set search_path = public, private
as $$
  select
    group_id_input,
    auth.uid(),
    private.get_group_role(group_id_input, auth.uid()) as role,
    private.has_group_role(group_id_input, auth.uid(), 'admin') as can_update_settings,
    private.has_group_role(group_id_input, auth.uid(), 'admin') as can_manage_members,
    private.has_group_role(group_id_input, auth.uid(), 'moderator') as can_moderate_content,
    private.has_group_role(group_id_input, auth.uid(), 'owner') as can_delete_group,
    private.has_group_role(group_id_input, auth.uid(), 'owner') as can_transfer_ownership
  where auth.uid() is not null
    and private.is_group_member(group_id_input, auth.uid());
$$;

create or replace function public.update_group_settings(
  group_id_input uuid,
  name_input text default null,
  is_public_input boolean default null
)
returns public.groups
language plpgsql
security definer
set search_path = public, private
as $$
declare
  current_user_id uuid := auth.uid();
  updated_group public.groups;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to update clique settings.';
  end if;

  if not private.can_manage_group(group_id_input, current_user_id) then
    raise exception 'Only owners and admins can update clique settings.';
  end if;

  update public.groups
  set name = coalesce(nullif(trim(name_input), ''), name),
      is_public = coalesce(is_public_input, is_public),
      updated_at = now()
  where id = group_id_input
  returning * into updated_group;

  if not found then
    raise exception 'Clique not found.';
  end if;

  return updated_group;
end;
$$;

create or replace function public.update_group_member_role(
  group_id_input uuid,
  member_id_input uuid,
  role_input text
)
returns public.group_members
language plpgsql
security definer
set search_path = public, private
as $$
declare
  current_user_id uuid := auth.uid();
  clean_role text := lower(trim(coalesce(role_input, '')));
  actor_role text;
  target_role text;
  updated_member public.group_members;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to manage members.';
  end if;

  if clean_role not in ('admin', 'moderator', 'member') then
    raise exception 'Use transfer ownership to assign the owner role.';
  end if;

  actor_role := private.get_group_role(group_id_input, current_user_id);
  target_role := private.get_group_role(group_id_input, member_id_input);

  if actor_role is null or target_role is null then
    raise exception 'Both users must belong to this clique.';
  end if;

  if target_role = 'owner' then
    raise exception 'Use transfer ownership to change the owner.';
  end if;

  if current_user_id = member_id_input then
    raise exception 'You cannot change your own role.';
  end if;

  if actor_role <> 'owner' and clean_role = 'admin' then
    raise exception 'Only the owner can promote admins.';
  end if;

  if actor_role <> 'owner' and private.group_role_rank(clean_role) >= private.group_role_rank(actor_role) then
    raise exception 'You can only assign roles below your own role.';
  end if;

  if not private.can_manage_group_member(group_id_input, current_user_id, member_id_input) then
    raise exception 'You do not have permission to manage this member.';
  end if;

  update public.group_members
  set role = clean_role
  where group_id = group_id_input
    and user_id = member_id_input
  returning * into updated_member;

  perform private.create_notification(
    member_id_input,
    current_user_id,
    'role_changed',
    'group',
    group_id_input::text,
    jsonb_build_object('role', clean_role)
  );

  return updated_member;
end;
$$;

create or replace function public.remove_group_member(group_id_input uuid, member_id_input uuid)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  current_user_id uuid := auth.uid();
  target_role text;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to remove members.';
  end if;

  target_role := private.get_group_role(group_id_input, member_id_input);

  if target_role is null then
    raise exception 'Member not found in this clique.';
  end if;

  if target_role = 'owner' then
    raise exception 'The owner cannot be removed. Transfer ownership or delete the clique.';
  end if;

  if current_user_id = member_id_input then
    delete from public.group_members
    where group_id = group_id_input
      and user_id = current_user_id;
    return;
  end if;

  if not private.can_manage_group_member(group_id_input, current_user_id, member_id_input) then
    raise exception 'You do not have permission to remove this member.';
  end if;

  delete from public.group_members
  where group_id = group_id_input
    and user_id = member_id_input;

  perform private.create_notification(
    member_id_input,
    current_user_id,
    'member_removed',
    'group',
    group_id_input::text,
    jsonb_build_object('groupId', group_id_input)
  );
end;
$$;

create or replace function public.leave_group(group_id_input uuid)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  current_user_id uuid := auth.uid();
  member_role text;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to leave a clique.';
  end if;

  member_role := private.get_group_role(group_id_input, current_user_id);

  if member_role is null then
    return;
  end if;

  if member_role = 'owner' then
    raise exception 'Transfer ownership or delete the clique before leaving.';
  end if;

  delete from public.group_members
  where group_id = group_id_input
    and user_id = current_user_id;
end;
$$;

create or replace function public.transfer_group_ownership(group_id_input uuid, new_owner_id_input uuid)
returns public.groups
language plpgsql
security definer
set search_path = public, private
as $$
declare
  current_user_id uuid := auth.uid();
  updated_group public.groups;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to transfer ownership.';
  end if;

  if not private.has_group_role(group_id_input, current_user_id, 'owner') then
    raise exception 'Only the current owner can transfer ownership.';
  end if;

  if not private.is_group_member(group_id_input, new_owner_id_input) then
    raise exception 'Choose an existing clique member as the new owner.';
  end if;

  if new_owner_id_input = current_user_id then
    select * into updated_group from public.groups where id = group_id_input;
    return updated_group;
  end if;

  update public.group_members
  set role = 'admin'
  where group_id = group_id_input
    and user_id = current_user_id;

  update public.group_members
  set role = 'owner'
  where group_id = group_id_input
    and user_id = new_owner_id_input;

  update public.groups
  set owner_id = new_owner_id_input,
      updated_at = now()
  where id = group_id_input
  returning * into updated_group;

  perform private.create_notification(
    new_owner_id_input,
    current_user_id,
    'role_changed',
    'group',
    group_id_input::text,
    jsonb_build_object('role', 'owner')
  );

  return updated_group;
end;
$$;

create or replace function public.delete_group(group_id_input uuid)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  current_user_id uuid := auth.uid();
  group_name text;
  member_record record;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to delete a clique.';
  end if;

  if not private.has_group_role(group_id_input, current_user_id, 'owner') then
    raise exception 'Only the owner can delete this clique.';
  end if;

  select name into group_name from public.groups where id = group_id_input;

  for member_record in
    select user_id from public.group_members where group_id = group_id_input and user_id <> current_user_id
  loop
    perform private.create_notification(
      member_record.user_id,
      current_user_id,
      'clique_deleted',
      'group',
      group_id_input::text,
      jsonb_build_object('groupName', group_name)
    );
  end loop;

  delete from public.groups
  where id = group_id_input
    and owner_id = current_user_id;
end;
$$;

create or replace function public.get_group_management_summary(group_id_input uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, private
as $$
  with current_permissions as (
    select * from public.get_group_permissions(group_id_input)
  ),
  member_rows as (
    select
      gm.user_id,
      coalesce(nullif(trim(gm.display_name), ''), nullif(trim(p.display_name), ''), split_part(coalesce(p.email, ''), '@', 1), 'Member') as display_name,
      gm.role,
      gm.joined_at
    from public.group_members gm
    left join public.profiles p on p.id = gm.user_id
    where gm.group_id = group_id_input
      and private.is_group_member(group_id_input, auth.uid())
    order by private.group_role_rank(gm.role) desc, gm.joined_at asc
  )
  select jsonb_build_object(
    'permissions', coalesce((select to_jsonb(cp) from current_permissions cp limit 1), '{}'::jsonb),
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'userId', mr.user_id,
        'displayName', mr.display_name,
        'role', mr.role,
        'joinedAt', mr.joined_at
      ))
      from member_rows mr
    ), '[]'::jsonb)
  );
$$;

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

create or replace function public.respond_friend_request(request_id_input uuid, response_input text)
returns public.friend_requests
language plpgsql
security definer
set search_path = public, private
as $$
declare
  current_user_id uuid := auth.uid();
  clean_response text := lower(trim(coalesce(response_input, '')));
  updated_request public.friend_requests;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to respond to friend requests.';
  end if;

  if clean_response not in ('accepted', 'declined') then
    raise exception 'Friend request response must be accepted or declined.';
  end if;

  update public.friend_requests
  set status = clean_response,
      updated_at = now(),
      responded_at = now()
  where id = request_id_input
    and addressee_id = current_user_id
    and status = 'pending'
  returning * into updated_request;

  if not found then
    raise exception 'Friend request not found.';
  end if;

  if clean_response = 'accepted' then
    insert into public.user_friends (user_id, friend_id)
    values
      (updated_request.requester_id, updated_request.addressee_id),
      (updated_request.addressee_id, updated_request.requester_id)
    on conflict (user_id, friend_id) do nothing;

    perform private.create_notification(
      updated_request.requester_id,
      current_user_id,
      'friend_accept',
      'profile',
      current_user_id::text,
      jsonb_build_object('memberId', current_user_id)
    );
  end if;

  return updated_request;
end;
$$;

create or replace function public.cancel_friend_request(request_id_input uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to cancel friend requests.';
  end if;

  update public.friend_requests
  set status = 'cancelled',
      updated_at = now()
  where id = request_id_input
    and requester_id = auth.uid()
    and status = 'pending';
end;
$$;

create or replace function public.get_friend_requests(status_input text default 'pending')
returns table(
  id uuid,
  direction text,
  user_id uuid,
  display_name text,
  status text,
  created_at timestamptz,
  responded_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with requests as (
    select *
    from public.friend_requests fr
    where auth.uid() is not null
      and (fr.requester_id = auth.uid() or fr.addressee_id = auth.uid())
      and (status_input is null or fr.status = status_input)
  )
  select
    r.id,
    case when r.addressee_id = auth.uid() then 'incoming' else 'outgoing' end as direction,
    case when r.addressee_id = auth.uid() then r.requester_id else r.addressee_id end as user_id,
    coalesce(nullif(trim(p.display_name), ''), split_part(coalesce(p.email, ''), '@', 1), 'CliqueBase member') as display_name,
    r.status,
    r.created_at,
    r.responded_at
  from requests r
  join public.profiles p on p.id = case when r.addressee_id = auth.uid() then r.requester_id else r.addressee_id end
  order by case when r.status = 'pending' then 0 else 1 end, r.created_at desc;
$$;

create or replace function public.get_notifications(limit_input integer default 30, include_read_input boolean default false)
returns table(
  id uuid,
  type text,
  actor_id uuid,
  actor_display_name text,
  entity_type text,
  entity_id text,
  payload jsonb,
  read_at timestamptz,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    n.id,
    n.type,
    n.actor_id,
    coalesce(nullif(trim(p.display_name), ''), split_part(coalesce(p.email, ''), '@', 1), 'CliqueBase member') as actor_display_name,
    n.entity_type,
    n.entity_id,
    n.payload,
    n.read_at,
    n.created_at
  from public.notifications n
  left join public.profiles p on p.id = n.actor_id
  where n.recipient_id = auth.uid()
    and (include_read_input or n.read_at is null)
  order by n.created_at desc
  limit greatest(1, least(coalesce(limit_input, 30), 100));
$$;

create or replace function public.mark_notification_read(notification_id_input uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.notifications
  set read_at = coalesce(read_at, now())
  where id = notification_id_input
    and recipient_id = auth.uid();
$$;

create or replace function public.mark_all_notifications_read()
returns void
language sql
security definer
set search_path = public
as $$
  update public.notifications
  set read_at = coalesce(read_at, now())
  where recipient_id = auth.uid()
    and read_at is null;
$$;

-- Lock destructive media actions to owners/moderators.
drop policy if exists "Movies are deletable by owner or moderators" on public.movies;
create policy "Movies are deletable by owner or moderators" on public.movies
for delete to authenticated
using (
  (group_id is null and owner_id = (select auth.uid()))
  or (group_id is not null and private.can_moderate_group_content(group_id, (select auth.uid())))
);

drop policy if exists "Series are deletable by owner or moderators" on public.series;
create policy "Series are deletable by owner or moderators" on public.series
for delete to authenticated
using (
  (group_id is null and owner_id = (select auth.uid()))
  or (group_id is not null and private.can_moderate_group_content(group_id, (select auth.uid())))
);

drop policy if exists "Games are deletable by owner or moderators" on public.games;
create policy "Games are deletable by owner or moderators" on public.games
for delete to authenticated
using (
  (group_id is null and owner_id = (select auth.uid()))
  or (group_id is not null and private.can_moderate_group_content(group_id, (select auth.uid())))
);

drop policy if exists "Videos are deletable by owner or group members" on public.videos;
drop policy if exists "Videos are deletable by owner or moderators" on public.videos;
create policy "Videos are deletable by owner or moderators" on public.videos
for delete to authenticated
using (
  (group_id is null and owner_id = (select auth.uid()))
  or (group_id is not null and private.can_moderate_group_content(group_id, (select auth.uid())))
);

grant execute on function public.get_group_permissions(uuid) to authenticated;
grant execute on function public.update_group_settings(uuid, text, boolean) to authenticated;
grant execute on function public.update_group_member_role(uuid, uuid, text) to authenticated;
grant execute on function public.remove_group_member(uuid, uuid) to authenticated;
grant execute on function public.leave_group(uuid) to authenticated;
grant execute on function public.transfer_group_ownership(uuid, uuid) to authenticated;
grant execute on function public.delete_group(uuid) to authenticated;
grant execute on function public.get_group_management_summary(uuid) to authenticated;
grant execute on function public.send_friend_request(uuid) to authenticated;
grant execute on function public.respond_friend_request(uuid, text) to authenticated;
grant execute on function public.cancel_friend_request(uuid) to authenticated;
grant execute on function public.get_friend_requests(text) to authenticated;
grant execute on function public.get_notifications(integer, boolean) to authenticated;
grant execute on function public.mark_notification_read(uuid) to authenticated;
grant execute on function public.mark_all_notifications_read() to authenticated;
