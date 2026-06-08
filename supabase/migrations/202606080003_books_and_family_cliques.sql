-- Books category plus lightweight family clique metadata.
-- Run after the existing social/activity/group migrations.

create extension if not exists pgcrypto;
create schema if not exists private;

alter table public.groups add column if not exists is_family boolean not null default false;
alter table public.groups add column if not exists family_safe boolean not null default false;
alter table public.groups add column if not exists minimum_age integer;

create table if not exists public.book_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  group_id uuid references public.groups(id) on delete cascade,
  source text not null default 'Open Library',
  source_id text,
  title text not null check (length(trim(title)) > 0),
  authors text[] not null default '{}',
  year text,
  isbn text,
  overview text,
  url text,
  poster text,
  subjects text[] not null default '{}',
  reading_status text not null default 'want' check (reading_status in ('want', 'reading', 'finished')),
  age_band text not null default 'unknown' check (age_band in ('kids', 'teen', 'adult', 'unknown')),
  nominated_by text not null default 'Someone',
  saved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.book_items enable row level security;

create index if not exists book_items_owner_id_idx on public.book_items(owner_id);
create index if not exists book_items_group_id_idx on public.book_items(group_id);
create index if not exists book_items_source_id_idx on public.book_items(source, source_id);
create index if not exists book_items_created_at_idx on public.book_items(created_at desc);
create unique index if not exists book_items_owner_source_unique on public.book_items(owner_id, source, source_id) where group_id is null and source_id is not null;
create unique index if not exists book_items_group_source_unique on public.book_items(group_id, source, source_id) where group_id is not null and source_id is not null;

drop policy if exists "Books are readable by owner or group members" on public.book_items;
drop policy if exists "Books are insertable by owner or group members" on public.book_items;
drop policy if exists "Books are updatable by owner or group members" on public.book_items;
drop policy if exists "Books are deletable by owner or group members" on public.book_items;

create policy "Books are readable by owner or group members" on public.book_items
  for select to authenticated
  using (
    owner_id = (select auth.uid())
    or (group_id is not null and private.is_group_member(group_id, (select auth.uid())))
  );

create policy "Books are insertable by owner or group members" on public.book_items
  for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and (group_id is null or private.is_group_member(group_id, (select auth.uid())))
  );

create policy "Books are updatable by owner or group members" on public.book_items
  for update to authenticated
  using (
    owner_id = (select auth.uid())
    or (group_id is not null and private.is_group_member(group_id, (select auth.uid())))
  )
  with check (
    owner_id = (select auth.uid())
    and (group_id is null or private.is_group_member(group_id, (select auth.uid())))
  );

create policy "Books are deletable by owner or group members" on public.book_items
  for delete to authenticated
  using (
    owner_id = (select auth.uid())
    or (group_id is not null and private.is_group_member(group_id, (select auth.uid())))
  );

alter table public.recommendation_notes drop constraint if exists recommendation_notes_item_type_check;
alter table public.recommendation_notes add constraint recommendation_notes_item_type_check check (item_type in ('movie', 'series', 'game', 'video', 'music', 'book', 'other'));

alter table public.media_comments drop constraint if exists media_comments_item_type_check;
alter table public.media_comments add constraint media_comments_item_type_check check (item_type in ('movie', 'series', 'game', 'video', 'music', 'book', 'other'));

alter table public.activity_events drop constraint if exists activity_events_type_check;
alter table public.activity_events add constraint activity_events_type_check check (type in (
  'recommendation_note',
  'media_comment',
  'media_share',
  'library_add',
  'completed',
  'clique_join',
  'friend_accept',
  'rating',
  'vote',
  'system'
));

create or replace function private.record_book_library_activity()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  actor_id_value uuid := coalesce(new.owner_id, auth.uid());
  book_id_value text;
  event_type text := 'library_add';
begin
  if actor_id_value is null then return new; end if;
  if new.group_id is not null and not private.is_group_member(new.group_id, actor_id_value) then return new; end if;

  book_id_value := coalesce(nullif(new.source_id, ''), new.id::text);

  if tg_op = 'INSERT' then
    event_type := case when new.reading_status = 'finished' then 'completed' else 'library_add' end;
    perform private.record_activity(
      actor_id_value,
      new.group_id,
      event_type,
      'book',
      book_id_value,
      new.title,
      jsonb_build_object(
        'scope', case when new.group_id is null then 'library' else 'clique' end,
        'poster', new.poster,
        'overview', new.overview,
        'authors', new.authors,
        'year', new.year,
        'isbn', new.isbn,
        'subjects', new.subjects,
        'readingStatus', new.reading_status,
        'ageBand', new.age_band,
        'source', new.source,
        'sourceId', new.source_id,
        'url', new.url,
        'nominatedBy', new.nominated_by
      )
    );
  elsif tg_op = 'UPDATE' and new.reading_status = 'finished' and old.reading_status is distinct from 'finished' then
    perform private.record_activity(
      actor_id_value,
      new.group_id,
      'completed',
      'book',
      book_id_value,
      new.title,
      jsonb_build_object('scope', case when new.group_id is null then 'library' else 'clique' end, 'poster', new.poster, 'overview', new.overview, 'authors', new.authors, 'readingStatus', new.reading_status, 'source', new.source, 'url', new.url)
    );
  end if;

  return new;
end;
$$;

drop trigger if exists record_book_feed_activity on public.book_items;
create trigger record_book_feed_activity
after insert or update of reading_status on public.book_items
for each row execute function private.record_book_library_activity();

create or replace function public.create_family_group(group_name_input text, display_name_input text default null)
returns public.groups
language plpgsql
security definer
set search_path = public, private
as $$
declare
  created_group public.groups;
begin
  created_group := public.create_group_with_member(group_name_input, display_name_input);
  update public.groups
  set is_family = true,
      family_safe = true,
      minimum_age = 13
  where id = created_group.id
  returning * into created_group;
  return created_group;
end;
$$;

grant execute on function public.create_family_group(text, text) to authenticated;
