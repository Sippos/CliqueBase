-- Keep the games table compatible with the shared media payload.
-- The frontend uses the same normalizer for movies, series, and games, so game
-- rows need these optional metadata columns even when RAWG does not provide them.

alter table public.games add column if not exists tmdb_rating numeric;
alter table public.games add column if not exists runtime integer;

-- Ask PostgREST/Supabase API to refresh its schema cache immediately after DDL.
notify pgrst, 'reload schema';
