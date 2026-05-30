-- Member-to-member media sharing support.
-- Adds searchable profile lookup by display name and a share inbox table.

create table if not exists public.media_shares (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  item_type text not null check (item_type in ('movie', 'series', 'game')),
  item_payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists media_shares_recipient_created_idx on public.media_shares(recipient_id, created_at desc);
create index if not exists media_shares_sender_created_idx on public.media_shares(sender_id, created_at desc);
create index if not exists profiles_display_name_search_idx on public.profiles using gin (display_name gin_trgm_ops);

alter table public.media_shares enable row level security;

drop policy if exists "Media shares are readable by sender or recipient" on public.media_shares;
drop policy if exists "Media shares are insertable by sender" on public.media_shares;
drop policy if exists "Media shares are updatable by recipient" on public.media_shares;

create policy "Media shares are readable by sender or recipient" on public.media_shares
for select to authenticated
using (sender_id = (select auth.uid()) or recipient_id = (select auth.uid()));

create policy "Media shares are insertable by sender" on public.media_shares
for insert to authenticated
with check (sender_id = (select auth.uid()));

create policy "Media shares are updatable by recipient" on public.media_shares
for update to authenticated
using (recipient_id = (select auth.uid()))
with check (recipient_id = (select auth.uid()));

create or replace function public.search_members_by_profile_name(search_input text, limit_input integer default 10)
returns table(id uuid, display_name text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.display_name
  from public.profiles p
  where auth.uid() is not null
    and p.id <> auth.uid()
    and length(trim(coalesce(search_input, ''))) >= 2
    and p.display_name ilike '%' || trim(search_input) || '%'
  order by
    case when lower(p.display_name) = lower(trim(search_input)) then 0 else 1 end,
    p.display_name asc
  limit greatest(1, least(coalesce(limit_input, 10), 25));
$$;

create or replace function public.share_media_with_member(recipient_id_input uuid, item_type_input text, payload_input jsonb)
returns public.media_shares
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  clean_item_type text := lower(trim(coalesce(item_type_input, '')));
  created_share public.media_shares;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to share media.';
  end if;

  if recipient_id_input is null then
    raise exception 'Choose a member to share with.';
  end if;

  if recipient_id_input = current_user_id then
    raise exception 'Choose another member to share with.';
  end if;

  if clean_item_type not in ('movie', 'series', 'game') then
    raise exception 'This content type cannot be shared yet.';
  end if;

  if not exists (select 1 from public.profiles p where p.id = recipient_id_input) then
    raise exception 'No member found for that profile.';
  end if;

  insert into public.media_shares (sender_id, recipient_id, item_type, item_payload)
  values (current_user_id, recipient_id_input, clean_item_type, coalesce(payload_input, '{}'::jsonb))
  returning * into created_share;

  return created_share;
end;
$$;

grant execute on function public.search_members_by_profile_name(text, integer) to authenticated;
grant execute on function public.share_media_with_member(uuid, text, jsonb) to authenticated;
