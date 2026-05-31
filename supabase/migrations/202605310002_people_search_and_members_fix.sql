-- People search + clique membership visibility hardening.
-- Run in Supabase SQL editor if member search returns no results or joined friends do not appear.

create extension if not exists pg_trgm;

create index if not exists profiles_display_name_search_idx
  on public.profiles using gin (display_name gin_trgm_ops);

create index if not exists profiles_email_search_idx
  on public.profiles using gin (email gin_trgm_ops);

create index if not exists group_members_group_joined_idx
  on public.group_members(group_id, joined_at asc);

-- Make profile search tolerant: profile name first, email prefix fallback, no duplicate users.
create or replace function public.search_members_by_profile_name(search_input text, limit_input integer default 10)
returns table(id uuid, display_name text)
language sql
stable
security definer
set search_path = public
as $$
  with cleaned as (
    select lower(trim(coalesce(search_input, ''))) as q,
           greatest(1, least(coalesce(limit_input, 10), 25)) as max_rows
  )
  select p.id,
         coalesce(nullif(trim(p.display_name), ''), split_part(coalesce(p.email, ''), '@', 1), 'CliqueBase member') as display_name
  from public.profiles p, cleaned c
  where auth.uid() is not null
    and p.id <> auth.uid()
    and length(c.q) >= 2
    and (
      lower(coalesce(p.display_name, '')) like '%' || c.q || '%'
      or lower(split_part(coalesce(p.email, ''), '@', 1)) like '%' || c.q || '%'
    )
  order by
    case when lower(coalesce(p.display_name, '')) = c.q then 0 else 1 end,
    case when lower(coalesce(p.display_name, '')) like c.q || '%' then 0 else 1 end,
    coalesce(p.display_name, p.email) asc
  limit (select max_rows from cleaned);
$$;

-- Helper that the app can use for a reliable current-member list after invite joins.
create or replace function public.get_group_members_for_user(group_id_input uuid)
returns table(user_id uuid, display_name text, role text, joined_at timestamptz)
language sql
stable
security definer
set search_path = public, private
as $$
  select gm.user_id,
         coalesce(nullif(trim(gm.display_name), ''), nullif(trim(p.display_name), ''), split_part(coalesce(p.email, ''), '@', 1), 'Member') as display_name,
         gm.role,
         gm.joined_at
  from public.group_members gm
  left join public.profiles p on p.id = gm.user_id
  where gm.group_id = group_id_input
    and private.is_group_member(group_id_input, auth.uid())
  order by case when gm.role = 'owner' then 0 else 1 end, gm.joined_at asc;
$$;

grant execute on function public.search_members_by_profile_name(text, integer) to authenticated;
grant execute on function public.get_group_members_for_user(uuid) to authenticated;
