# CliqueBase

CliqueBase is a Vite + React prototype for choosing what to watch, play, or try next with friends. It still works in local demo mode, but it now has the foundation for real Supabase accounts, private groups, group membership, social recommendations, and group-scoped media piles.

## Product direction

CliqueBase should focus first on one clear loop:

```text
Recommend -> discuss -> vote -> choose -> watch/play/try -> mark done -> rate -> remember
```

The product strategy and phased implementation guide live in [`docs/product-strategy.md`](docs/product-strategy.md). Use that document as the decision filter before adding broad discovery or community features.

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

Run the files in `supabase/migrations/` in filename order. The core migrations create:

- `profiles` for display names tied to Supabase Auth users.
- `groups` and `group_members` for private cliques and invite codes.
- group-scoped and personal movies, series, and games.
- RLS policies that only allow owners or members to see and edit scoped data.
- RPC helpers for creating groups, joining by invite, voting, social activity, polls, decisions, and mark-done/rating follow-up.

Decision-loop migrations add `decision_sessions`. When a Tonight Mode poll is locked, the winning option is persisted as a decision. When that decision is marked done, matching movie, series, or game rows are marked watched/finished/played if the decision has `item_type` and `item_id`. Media table ratings are integer `1–10`, so a `0/10` decision rating is preserved on the decision session but not written into the media row.

After the migrations, open the Profile button in the navbar to create an account or sign in. From there, you can create or join Supabase-backed groups.

## Current modes

- **Local demo mode:** works without Supabase and stores groups in `localStorage`.
- **Supabase mode:** enabled when Supabase env vars are present and the user is signed in. Account and group controls are available in the Profile modal.

## Next implementation step

Build the Phase 1 core decision loop from the product strategy guide: recommendation notes, clique voting/selection, TonightMode eligibility, mark-done/rating follow-up, and empty states that push users toward the next action.

<!-- vercel-redeploy: 2026-05-31-0058 -->
