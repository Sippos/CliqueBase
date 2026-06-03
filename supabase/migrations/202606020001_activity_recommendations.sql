-- Activity feed, recommendation notes, and lightweight comments for the community home.
-- Run after 202606010005_social_governance.sql.

create extension if not exists pgcrypto;

create table if not exists public.recommendation_notes (
  id uuid primary key default gen_random_uuid(),
  item_type text not null check (item_type in ('movie', 'series', 'game', 'video', 'music', 'other')),
  item_id text not null,
  group_id uuid references public.groups(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  recommended_to uuid references auth.users(id) on delete set null,
  title text not null default 'Untitled pick',
  note text not null default '',
  mood_tags text[] not null default '{}',
  context_label text,
  priority text not null default 'maybe' check (priority in ('must', 'maybe', 'later')),
  status text not null default 'saved' check (status in ('saved', 'accepted', 'rejected', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists recommendation_notes_owner_created_idx on public.recommendation_notes(owner_id, created_at desc);
create index if not exists recommendation_notes_target_created_idx on public.recommendation_notes(recommended_to, created_at desc);
create index if not exists recommendation_notes_group_created_idx on public.recommendation_notes(group_id, created_at desc);
create index if not exists recommendation_notes_item_idx on public.recommendation_notes(item_type, item_id);

create table if not exists public.media_comments (
  id uuid primary key default gen_random_uuid(),
  item_type text not null check (item_type in ('movie', 'series', 'game', 'video', 'music', 'other')),
  item_id text not null,
  group_id uuid references public.groups(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (length(trim(body)) > 0 and length(body) <= 1200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists media_comments_item_created_idx on public.media_comments(item_type, item_id, created_at desc);
create index if not exists media_comments_group_created_idx on public.media_comments(group_id, created_at desc);

create table if not exists public.activity_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  group_id uuid references public.groups(id) on delete cascade,
  type text not null check (type in (
    'recommendation_note',
    'media_comment',
    'media_share',
    'clique_join',
    'friend_accept',
    'rating',
    'system'
  )),
  item_type text,
  item_id text,
  title text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists activity_events_actor_created_idx on public.activity_events(actor_id, created_at desc);
create index if not exists activity_events_group_created_idx on public.activity_events(group_id, created_at desc);
create index if not exists activity_events_created_idx on public.activity_events(created_at desc);

alter table public.recommendation_notes enable row level security;
alter table public.media_comments enable row level security;
alter table public.activity_events enable row level security;

drop policy if exists "Recommendation notes are readable by visible participants" on public.recommendation_notes;
drop policy if exists "Recommendation notes are insertable by owner" on public.recommendation_notes;
drop policy if exists "Recommendation notes are updateable by owner or recipient" on public.recommendation_notes;
drop policy if exists "Recommendation notes are deletable by owner" on public.recommendation_notes;

create policy "Recommendation notes are readable by visible participants"
on public.recommendation_notes for select to authenticated
using (
  owner_id = (select auth.uid())
  or recommended_to = (select auth.uid())
  or (group_id is not null and private.is_group_member(group_id, (select auth.uid())))
);

create policy "Recommendation notes are insertable by owner"
on public.recommendation_notes for insert to authenticated
with check (
  owner_id = (select auth.uid())
  and (group_id is null or private.is_group_member(group_id, (select auth.uid())))
);

create policy "Recommendation notes are updateable by owner or recipient"
on public.recommendation_notes for update to authenticated
using (owner_id = (select auth.uid()) or recommended_to = (select auth.uid()))
with check (owner_id = (select auth.uid()) or recommended_to = (select auth.uid()));

create policy "Recommendation notes are deletable by owner"
on public.recommendation_notes for delete to authenticated
using (owner_id = (select auth.uid()));

drop policy if exists "Media comments are readable by group members or owner" on public.media_comments;
drop policy if exists "Media comments are insertable by group members or owner" on public.media_comments;
drop policy if exists "Media comments are updateable by owner" on public.media_comments;
drop policy if exists "Media comments are deletable by owner or moderators" on public.media_comments;

create policy "Media comments are readable by group members or owner"
on public.media_comments for select to authenticated
using (owner_id = (select auth.uid()) or (group_id is not null and private.is_group_member(group_id, (select auth.uid()))));

create policy "Media comments are insertable by group members or owner"
on public.media_comments for insert to authenticated
with check (owner_id = (select auth.uid()) and (group_id is null or private.is_group_member(group_id, (select auth.uid()))));

create policy "Media comments are updateable by owner"
on public.media_comments for update to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

create policy "Media comments are deletable by owner or moderators"
on public.media_comments for delete to authenticated
using (owner_id = (select auth.uid()) or (group_id is not null and private.can_moderate_group_content(group_id, (select auth.uid()))));

drop policy if exists "Activity events are readable by visible participants" on public.activity_events;
drop policy if exists "Activity events are insertable by actor" on public.activity_events;

create policy "Activity events are readable by visible participants"
on public.activity_events for select to authenticated
using (
  actor_id = (select auth.uid())
  or group_id is null
  or private.is_group_member(group_id, (select auth.uid()))
);

create policy "Activity events are insertable by actor"
on public.activity_events for insert to authenticated
with check (actor_id = (select auth.uid()) and (group_id is null or private.is_group_member(group_id, (select auth.uid()))));

create or replace function private.record_activity(
  actor_id_input uuid,
  group_id_input uuid,
  type_input text,
  item_type_input text default null,
  item_id_input text default null,
  title_input text default null,
  payload_input jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.activity_events (actor_id, group_id, type, item_type, item_id, title, payload)
  values (actor_id_input, group_id_input, type_input, item_type_input, item_id_input, title_input, coalesce(payload_input, '{}'::jsonb));
end;
$$;

create or replace function public.create_recommendation_note(
  item_type_input text,
  item_id_input text,
  title_input text,
  note_input text default '',
  group_id_input uuid default null,
  recommended_to_input uuid default null,
  mood_tags_input text[] default '{}',
  context_label_input text default null,
  priority_input text default 'maybe'
)
returns public.recommendation_notes
language plpgsql
security definer
set search_path = public, private
as $$
declare
  current_user_id uuid := auth.uid();
  clean_item_type text := lower(trim(coalesce(item_type_input, 'other')));
  clean_priority text := lower(trim(coalesce(priority_input, 'maybe')));
  created_note public.recommendation_notes;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to recommend something.';
  end if;

  if clean_item_type not in ('movie', 'series', 'game', 'video', 'music', 'other') then
    clean_item_type := 'other';
  end if;

  if clean_priority not in ('must', 'maybe', 'later') then
    clean_priority := 'maybe';
  end if;

  if group_id_input is not null and not private.is_group_member(group_id_input, current_user_id) then
    raise exception 'You must belong to this clique to recommend there.';
  end if;

  insert into public.recommendation_notes (
    item_type,
    item_id,
    group_id,
    owner_id,
    recommended_to,
    title,
    note,
    mood_tags,
    context_label,
    priority
  )
  values (
    clean_item_type,
    trim(coalesce(item_id_input, '')),
    group_id_input,
    current_user_id,
    recommended_to_input,
    coalesce(nullif(trim(title_input), ''), 'Untitled pick'),
    coalesce(note_input, ''),
    coalesce(mood_tags_input, '{}'),
    nullif(trim(coalesce(context_label_input, '')), ''),
    clean_priority
  )
  returning * into created_note;

  perform private.record_activity(
    current_user_id,
    group_id_input,
    'recommendation_note',
    clean_item_type,
    created_note.item_id,
    created_note.title,
    jsonb_build_object(
      'noteId', created_note.id,
      'note', created_note.note,
      'priority', created_note.priority,
      'moodTags', created_note.mood_tags,
      'contextLabel', created_note.context_label,
      'recommendedTo', created_note.recommended_to
    )
  );

  if recommended_to_input is not null then
    perform private.create_notification(
      recommended_to_input,
      current_user_id,
      'media_share',
      clean_item_type,
      created_note.item_id,
      jsonb_build_object('title', created_note.title, 'noteId', created_note.id, 'note', created_note.note)
    );
  end if;

  return created_note;
end;
$$;

create or replace function public.add_media_comment(
  item_type_input text,
  item_id_input text,
  title_input text,
  body_input text,
  group_id_input uuid default null
)
returns public.media_comments
language plpgsql
security definer
set search_path = public, private
as $$
declare
  current_user_id uuid := auth.uid();
  clean_item_type text := lower(trim(coalesce(item_type_input, 'other')));
  created_comment public.media_comments;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to comment.';
  end if;

  if clean_item_type not in ('movie', 'series', 'game', 'video', 'music', 'other') then
    clean_item_type := 'other';
  end if;

  if length(trim(coalesce(body_input, ''))) = 0 then
    raise exception 'Comment cannot be empty.';
  end if;

  if group_id_input is not null and not private.is_group_member(group_id_input, current_user_id) then
    raise exception 'You must belong to this clique to comment there.';
  end if;

  insert into public.media_comments (item_type, item_id, group_id, owner_id, body)
  values (clean_item_type, trim(coalesce(item_id_input, '')), group_id_input, current_user_id, trim(body_input))
  returning * into created_comment;

  perform private.record_activity(
    current_user_id,
    group_id_input,
    'media_comment',
    clean_item_type,
    created_comment.item_id,
    coalesce(nullif(trim(title_input), ''), 'Untitled pick'),
    jsonb_build_object('commentId', created_comment.id, 'body', created_comment.body)
  );

  return created_comment;
end;
$$;

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
    and (
      ae.actor_id = auth.uid()
      or ae.group_id is null
      or private.is_group_member(ae.group_id, auth.uid())
      or (include_public_input and coalesce(g.is_public, false))
    )
  order by ae.created_at desc
  limit greatest(1, least(coalesce(limit_input, 40), 100));
$$;

drop trigger if exists set_recommendation_notes_updated_at on public.recommendation_notes;
create trigger set_recommendation_notes_updated_at
before update on public.recommendation_notes
for each row execute function public.set_updated_at();

drop trigger if exists set_media_comments_updated_at on public.media_comments;
create trigger set_media_comments_updated_at
before update on public.media_comments
for each row execute function public.set_updated_at();

grant execute on function public.create_recommendation_note(text, text, text, text, uuid, uuid, text[], text, text) to authenticated;
grant execute on function public.add_media_comment(text, text, text, text, uuid) to authenticated;
grant execute on function public.get_social_activity(integer, boolean) to authenticated;
