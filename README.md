# CliqueBase

CliqueBase is a Vite + React prototype for choosing what to watch with friends. It still works in local demo mode, but it now has the foundation for real Supabase accounts, private groups, group membership, and group-scoped movie piles.

## Local development

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` and fill in the browser-safe Supabase values when you want real accounts:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-or-publishable-key
```

The TMDB key stays server-only:

```bash
TMDB_API_KEY=your-tmdb-api-key
```

## Supabase setup

Run `supabase/migrations/202605300001_auth_groups_movies.sql` in the Supabase SQL editor or through the Supabase CLI. It creates:

- `profiles` for display names tied to Supabase Auth users.
- `groups` and `group_members` for private cliques and invite codes.
- group-scoped `movies`, so each clique can have a separate movie pile.
- RLS policies that only allow members to see and edit their group data.
- RPC helpers for creating groups, joining by invite, and voting.

After the migration, open the Profile button in the navbar to create an account or sign in. From there, you can create or join Supabase-backed groups.

## Current modes

- **Local demo mode:** works without Supabase and stores groups in `localStorage`.
- **Supabase mode:** enabled when Supabase env vars are present and the user is signed in. Account and group controls are available in the Profile modal.

## Next implementation step

The database and auth/group helpers are ready for the next UI pass: making the Movies page always read/write against the active Supabase group and adding a visible “send movie to another group” form.
