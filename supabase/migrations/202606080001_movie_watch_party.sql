-- Store who watched a movie together in a family group / clique.
-- Run after the base movies/group migrations.

alter table public.movies
  add column if not exists watched_with jsonb not null default '[]'::jsonb;

create index if not exists movies_group_watched_with_idx
  on public.movies using gin (watched_with)
  where group_id is not null;
