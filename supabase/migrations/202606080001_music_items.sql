-- Music library persistence for Spotify/YouTube/Apple Music/SoundCloud links.
-- Run this after the auth/groups migrations.

create extension if not exists pgcrypto;
create schema if not exists private;

create table if not exists public.music_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  group_id uuid references public.groups(id) on delete cascade,
  source text not null default 'Music link',
  source_id text,
  item_type text not null default 'track',
  title text not null check (length(trim(title)) > 0),
  artist text,
  album text,
  url text not null,
  poster text,
  preview_url text,
  nominated_by text not null default 'Someone',
  saved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.music_items enable row level security;

create index if not exists music_items_owner_id_idx on public.music_items(owner_id);
create index if not exists music_items_group_id_idx on public.music_items(group_id);
create index if not exists music_items_source_id_idx on public.music_items(source, source_id);
create index if not exists music_items_created_at_idx on public.music_items(created_at desc);
create unique index if not exists music_items_owner_source_unique on public.music_items(owner_id, source, source_id) where group_id is null and source_id is not null;
create unique index if not exists music_items_group_source_unique on public.music_items(group_id, source, source_id) where group_id is not null and source_id is not null;

-- Keep policies explicit so personal music stays private and clique music is shared only with members.
drop policy if exists "Music is readable by owner or group members" on public.music_items;
drop policy if exists "Music is insertable by owner or group members" on public.music_items;
drop policy if exists "Music is updatable by owner or group members" on public.music_items;
drop policy if exists "Music is deletable by owner or group members" on public.music_items;

create policy "Music is readable by owner or group members" on public.music_items
  for select to authenticated
  using (
    owner_id = (select auth.uid())
    or (group_id is not null and private.is_group_member(group_id, (select auth.uid())))
  );

create policy "Music is insertable by owner or group members" on public.music_items
  for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and (group_id is null or private.is_group_member(group_id, (select auth.uid())))
  );

create policy "Music is updatable by owner or group members" on public.music_items
  for update to authenticated
  using (
    owner_id = (select auth.uid())
    or (group_id is not null and private.is_group_member(group_id, (select auth.uid())))
  )
  with check (
    owner_id = (select auth.uid())
    and (group_id is null or private.is_group_member(group_id, (select auth.uid())))
  );

create policy "Music is deletable by owner or group members" on public.music_items
  for delete to authenticated
  using (
    owner_id = (select auth.uid())
    or (group_id is not null and private.is_group_member(group_id, (select auth.uid())))
  );
