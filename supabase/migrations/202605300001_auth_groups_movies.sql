-- Supabase foundation for accounts, group membership, and group-scoped movie piles.
-- Run this in Supabase SQL editor or through Supabase migrations before deploying the auth UI.

create extension if not exists pgcrypto;
create schema if not exists private;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text not null default 'Friend',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  invite_code text not null unique default lower(substr(encode(gen_random_bytes(9), 'hex'), 1, 12)),
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null default 'Friend',
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

alter table public.movies add column if not exists group_id uuid references public.groups(id) on delete cascade;
alter table public.movies add column if not exists updated_at timestamptz not null default now();

alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.movies enable row level security;

create or replace function private.is_group_member(target_group_id uuid, target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target_user_id is not null
    and exists (
      select 1
      from public.group_members gm
      where gm.group_id = target_group_id
        and gm.user_id = target_user_id
    );
$$;

create index if not exists group_members_user_id_idx on public.group_members(user_id);
create index if not exists groups_invite_code_idx on public.groups(invite_code);
create index if not exists movies_group_id_idx on public.movies(group_id);
create unique index if not exists movies_group_movie_unique on public.movies(group_id, movie_id);

drop policy if exists "Profiles are readable by owner" on public.profiles;
drop policy if exists "Profiles are insertable by owner" on public.profiles;
drop policy if exists "Profiles are updatable by owner" on public.profiles;
drop policy if exists "Groups are readable by members" on public.groups;
drop policy if exists "Group members are readable by group members" on public.group_members;
drop policy if exists "Movies are readable by group members" on public.movies;
drop policy if exists "Movies are insertable by group members" on public.movies;
drop policy if exists "Movies are updatable by group members" on public.movies;

create policy "Profiles are readable by owner" on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy "Profiles are insertable by owner" on public.profiles for insert to authenticated with check (id = (select auth.uid()));
create policy "Profiles are updatable by owner" on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "Groups are readable by members" on public.groups for select to authenticated using (private.is_group_member(id, (select auth.uid())));
create policy "Group members are readable by group members" on public.group_members for select to authenticated using (private.is_group_member(group_id, (select auth.uid())));
create policy "Movies are readable by group members" on public.movies for select to authenticated using (group_id is null or private.is_group_member(group_id, (select auth.uid())));
create policy "Movies are insertable by group members" on public.movies for insert to authenticated with check (group_id is null or private.is_group_member(group_id, (select auth.uid())));
create policy "Movies are updatable by group members" on public.movies for update to authenticated using (group_id is null or private.is_group_member(group_id, (select auth.uid()))) with check (group_id is null or private.is_group_member(group_id, (select auth.uid())));

create or replace function public.create_group_with_member(group_name_input text, display_name_input text default null)
returns public.groups
language plpgsql
security definer
set search_path = public, private
as $$
declare
  current_user_id uuid := auth.uid();
  clean_name text := nullif(trim(coalesce(group_name_input, '')), '');
  clean_display_name text := coalesce(nullif(trim(coalesce(display_name_input, '')), ''), 'Friend');
  new_group public.groups;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to create a group.';
  end if;

  insert into public.profiles (id, email, display_name, updated_at)
  values (current_user_id, coalesce((auth.jwt() ->> 'email'), ''), clean_display_name, now())
  on conflict (id) do update set display_name = excluded.display_name, email = excluded.email, updated_at = now();

  insert into public.groups (name, owner_id)
  values (coalesce(clean_name, 'New clique'), current_user_id)
  returning * into new_group;

  insert into public.group_members (group_id, user_id, display_name, role)
  values (new_group.id, current_user_id, clean_display_name, 'owner')
  on conflict (group_id, user_id) do update set display_name = excluded.display_name, role = excluded.role;

  return new_group;
end;
$$;

create or replace function public.join_group_by_invite(invite_code_input text, display_name_input text default null)
returns public.groups
language plpgsql
security definer
set search_path = public, private
as $$
declare
  current_user_id uuid := auth.uid();
  clean_invite_code text := nullif(trim(coalesce(invite_code_input, '')), '');
  clean_display_name text := coalesce(nullif(trim(coalesce(display_name_input, '')), ''), 'Friend');
  matched_group public.groups;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to join a group.';
  end if;
  if clean_invite_code is null then
    raise exception 'Invite code is required.';
  end if;

  select * into matched_group from public.groups where invite_code = clean_invite_code limit 1;
  if not found then
    raise exception 'No group found for that invite code.';
  end if;

  insert into public.profiles (id, email, display_name, updated_at)
  values (current_user_id, coalesce((auth.jwt() ->> 'email'), ''), clean_display_name, now())
  on conflict (id) do update set display_name = excluded.display_name, email = excluded.email, updated_at = now();

  insert into public.group_members (group_id, user_id, display_name, role)
  values (matched_group.id, current_user_id, clean_display_name, 'member')
  on conflict (group_id, user_id) do update set display_name = excluded.display_name;

  return matched_group;
end;
$$;

create or replace function public.vote_movie(movie_id_input text, vote_delta_input integer, group_id_input uuid default null)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if group_id_input is not null and (auth.uid() is null or not private.is_group_member(group_id_input, auth.uid())) then
    raise exception 'You must be a member of this group to vote.';
  end if;

  update public.movies
  set picks = greatest(0, coalesce(picks, 0) + 1),
      score = coalesce(score, 0) + coalesce(vote_delta_input, 0),
      updated_at = now()
  where movie_id = movie_id_input
    and (group_id_input is null or group_id = group_id_input);
end;
$$;

grant execute on function public.create_group_with_member(text, text) to authenticated;
grant execute on function public.join_group_by_invite(text, text) to authenticated;
grant execute on function public.vote_movie(text, integer, uuid) to authenticated;
