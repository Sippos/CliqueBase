-- Allow users to delete their own video suggestions or videos in cliques they belong to.

alter table public.videos enable row level security;

drop policy if exists "Videos are deletable by owner or group members" on public.videos;

create policy "Videos are deletable by owner or group members" on public.videos
for delete to authenticated
using (
  (group_id is null and owner_id = (select auth.uid()))
  or (group_id is not null and private.is_group_member(group_id, (select auth.uid())))
);
