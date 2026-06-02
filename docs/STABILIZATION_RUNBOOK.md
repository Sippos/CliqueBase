# CliqueBase stabilization runbook

Use this checklist after schema or social-flow changes, especially around Community, cliques, friend requests, reports, and blocking.

## Local build checks

```bash
npm ci
npm run lint
npm run build
```

The GitHub Actions CI runs the same checks on pushes to `main` and on pull requests.

## Supabase migration order

Run migrations through the Supabase CLI whenever possible:

```bash
supabase db push
```

For a clean local database, use the standard Supabase reset flow for your environment, then run the app against that database.

The newer safety migrations are intentionally defensive because some were tested manually in the SQL editor. Several of them recreate `public.user_blocks` and its RLS policies with `create table if not exists` / `drop policy if exists`. This is safe but noisy. Prefer applying the full migration set in timestamp order instead of copy-pasting individual SQL snippets.

## Manual SQL recovery notes

If a manual SQL run fails with:

```text
relation "public.user_blocks" does not exist
```

run the latest block-related migration that creates `public.user_blocks` before running feed or friend-request RPC replacements. The current self-contained files are:

- `supabase/migrations/202606020005_feed_block_filter.sql`
- `supabase/migrations/202606020006_blocked_users_list.sql`
- `supabase/migrations/202606020007_friend_request_block_guard.sql`
- `supabase/migrations/202606020008_block_cleanup.sql`

## Social/safety smoke tests

Use at least two test users.

### Community feed

1. Sign in as User A.
2. Create a recommendation note.
3. Add a comment to the recommendation.
4. Confirm the feed refreshes and shows the activity.

### Reports

1. Sign in as User A and report an activity inside a clique.
2. Sign in as a clique moderator/admin/owner.
3. Open clique settings.
4. Confirm the moderation inbox appears.
5. Mark the report reviewed or dismissed.
6. Confirm it disappears from open reports.

### Blocking

1. Sign in as User A.
2. Block User B from the Community feed.
3. Confirm User B's activity disappears after refresh.
4. Open the blocked members panel.
5. Unblock User B.
6. Confirm User B can reappear in the feed when otherwise visible.

### Friend requests and blocks

1. Confirm User A can send User B a friend request when neither has blocked the other.
2. Block User B as User A.
3. Confirm the friendship is removed and pending requests are cancelled.
4. Confirm User A cannot send a new friend request to User B while blocked.
5. Unblock User B.
6. Confirm a new friend request can be sent again.

### Tonight Mode / clique polls

1. Join or create a clique.
2. Create a poll with at least two options.
3. Vote as another member.
4. Confirm vote totals and percentages update.

## Known follow-up cleanup

- The profile search UI should fully use friend-request wording: `Send request`, `Request sent`, and only show `Friend` after acceptance.
- The defensive block migrations could later be consolidated into a cleaner baseline migration for production.
- Add SQL linting or a disposable Supabase migration test job once the project has a stable local Supabase setup in CI.
