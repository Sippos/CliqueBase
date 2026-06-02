-- Make the community activity triggers safe for repeated local resets and branch replays.

-- The original activity migration creates these triggers after creating the tables.
-- Dropping before recreating keeps local database replays idempotent when a dev
-- has already applied the migration manually.
drop trigger if exists set_recommendation_notes_updated_at on public.recommendation_notes;
drop trigger if exists set_media_comments_updated_at on public.media_comments;

create trigger set_recommendation_notes_updated_at
before update on public.recommendation_notes
for each row execute function public.set_updated_at();

create trigger set_media_comments_updated_at
before update on public.media_comments
for each row execute function public.set_updated_at();
