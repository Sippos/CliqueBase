create table if not exists public.movies (
  id bigserial primary key,
  movie_id text not null unique,
  title text not null,
  year text,
  released date,
  poster text,
  backdrop text,
  overview text,
  tmdb_rating numeric,
  runtime integer,
  genres text[] not null default '{}',
  nominated_by text,
  picks integer not null default 0,
  score integer not null default 0,
  watched boolean not null default false,
  my_rating integer check (my_rating between 1 and 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.movies enable row level security;

drop policy if exists "movies are readable" on public.movies;
create policy "movies are readable"
  on public.movies for select
  using (true);

drop policy if exists "movies are insertable" on public.movies;
create policy "movies are insertable"
  on public.movies for insert
  with check (true);

drop policy if exists "movies are updateable" on public.movies;
create policy "movies are updateable"
  on public.movies for update
  using (true)
  with check (true);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_movies_updated_at on public.movies;
create trigger set_movies_updated_at
  before update on public.movies
  for each row
  execute function public.set_updated_at();

create or replace function public.vote_movie(movie_id_input text, vote_delta_input integer)
returns void
language plpgsql
as $$
begin
  update public.movies
  set
    picks = greatest(0, picks + case when vote_delta_input > 0 then 1 else 0 end),
    score = score + vote_delta_input
  where movie_id = movie_id_input;
end;
$$;
