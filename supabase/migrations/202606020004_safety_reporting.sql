-- Trust and safety primitives for a community app: user blocks and content reports.

create table if not exists public.user_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  group_id uuid references public.groups(id) on delete cascade,
  item_type text not null default 'other' check (item_type in ('movie', 'series', 'game', 'video', 'music', 'other', 'activity', 'profile', 'poll')),
  item_id text,
  reason text not null check (reason in ('spam', 'harassment', 'spoiler', 'unsafe', 'other')),
  details text not null default '' check (length(details) <= 1600),
  status text not null default 'open' check (status in ('open', 'reviewed', 'dismissed')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null
);

create index if not exists user_blocks_blocked_idx on public.user_blocks(blocked_id);
create index if not exists content_reports_reporter_created_idx on public.content_reports(reporter_id, created_at desc);
create index if not exists content_reports_group_status_idx on public.content_reports(group_id, status, created_at desc);
create index if not exists content_reports_item_idx on public.content_reports(item_type, item_id);

alter table public.user_blocks enable row level security;
alter table public.content_reports enable row level security;

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

drop policy if exists "Reports readable by reporter or moderators" on public.content_reports;
drop policy if exists "Reports insertable by reporter" on public.content_reports;
drop policy if exists "Reports updateable by moderators" on public.content_reports;

create policy "Reports readable by reporter or moderators"
on public.content_reports for select to authenticated
using (
  reporter_id = (select auth.uid())
  or (group_id is not null and private.can_moderate_group_content(group_id, (select auth.uid())))
);

create policy "Reports insertable by reporter"
on public.content_reports for insert to authenticated
with check (
  reporter_id = (select auth.uid())
  and (group_id is null or private.is_group_member(group_id, (select auth.uid())))
);

create policy "Reports updateable by moderators"
on public.content_reports for update to authenticated
using (group_id is not null and private.can_moderate_group_content(group_id, (select auth.uid())))
with check (group_id is not null and private.can_moderate_group_content(group_id, (select auth.uid())));

create or replace function public.block_user(blocked_id_input uuid)
returns void
language plpgsql
security definer
set search_path = public, private
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
end;
$$;

create or replace function public.unblock_user(blocked_id_input uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to unblock someone.';
  end if;
  delete from public.user_blocks
  where blocker_id = auth.uid() and blocked_id = blocked_id_input;
end;
$$;

create or replace function public.report_content(
  actor_id_input uuid,
  group_id_input uuid,
  item_type_input text,
  item_id_input text,
  reason_input text,
  details_input text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare
  current_user_id uuid := auth.uid();
  clean_type text := lower(trim(coalesce(item_type_input, 'other')));
  clean_reason text := lower(trim(coalesce(reason_input, 'other')));
  report_id uuid;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to report content.';
  end if;

  if clean_type not in ('movie', 'series', 'game', 'video', 'music', 'other', 'activity', 'profile', 'poll') then
    clean_type := 'other';
  end if;

  if clean_reason not in ('spam', 'harassment', 'spoiler', 'unsafe', 'other') then
    clean_reason := 'other';
  end if;

  if group_id_input is not null and not private.is_group_member(group_id_input, current_user_id) then
    raise exception 'You must belong to this clique to report its content.';
  end if;

  insert into public.content_reports (reporter_id, actor_id, group_id, item_type, item_id, reason, details)
  values (current_user_id, actor_id_input, group_id_input, clean_type, nullif(trim(coalesce(item_id_input, '')), ''), clean_reason, left(coalesce(details_input, ''), 1600))
  returning id into report_id;

  return report_id;
end;
$$;

create or replace function public.get_group_reports(group_id_input uuid, include_reviewed_input boolean default false)
returns table(
  id uuid,
  reporter_id uuid,
  reporter_display_name text,
  actor_id uuid,
  actor_display_name text,
  group_id uuid,
  item_type text,
  item_id text,
  reason text,
  details text,
  status text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public, private
as $$
  select
    r.id,
    r.reporter_id,
    coalesce(nullif(trim(reporter.display_name), ''), split_part(coalesce(reporter.email, ''), '@', 1), 'CliqueBase member') as reporter_display_name,
    r.actor_id,
    coalesce(nullif(trim(actor.display_name), ''), split_part(coalesce(actor.email, ''), '@', 1), 'CliqueBase member') as actor_display_name,
    r.group_id,
    r.item_type,
    r.item_id,
    r.reason,
    r.details,
    r.status,
    r.created_at
  from public.content_reports r
  left join public.profiles reporter on reporter.id = r.reporter_id
  left join public.profiles actor on actor.id = r.actor_id
  where r.group_id = group_id_input
    and private.can_moderate_group_content(r.group_id, auth.uid())
    and (include_reviewed_input or r.status = 'open')
  order by r.created_at desc;
$$;

create or replace function public.review_content_report(report_id_input uuid, next_status_input text default 'reviewed')
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  current_user_id uuid := auth.uid();
  target_group_id uuid;
  clean_status text := lower(trim(coalesce(next_status_input, 'reviewed')));
begin
  if current_user_id is null then
    raise exception 'You must be signed in to review reports.';
  end if;
  if clean_status not in ('reviewed', 'dismissed') then
    clean_status := 'reviewed';
  end if;

  select group_id into target_group_id from public.content_reports where id = report_id_input;
  if target_group_id is null or not private.can_moderate_group_content(target_group_id, current_user_id) then
    raise exception 'Only clique moderators can review this report.';
  end if;

  update public.content_reports
  set status = clean_status,
      reviewed_at = now(),
      reviewed_by = current_user_id
  where id = report_id_input;
end;
$$;

grant execute on function public.block_user(uuid) to authenticated;
grant execute on function public.unblock_user(uuid) to authenticated;
grant execute on function public.report_content(uuid, uuid, text, text, text, text) to authenticated;
grant execute on function public.get_group_reports(uuid, boolean) to authenticated;
grant execute on function public.review_content_report(uuid, text) to authenticated;
