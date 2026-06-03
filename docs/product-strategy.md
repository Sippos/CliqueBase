# CliqueBase product strategy

CliqueBase should focus on one wedge before expanding into a broad recommendation network:

> Help friend groups decide what to watch, play, or try next using the taste of people they actually trust.

This document turns the roadmap in issue #16 into implementation constraints for product, design, and engineering decisions.

## Product wedge

The first high-confidence audience is friend groups that already discuss movies, series, games, music, videos, or other recommendations in chats, but struggle to decide what to do next.

The app should not start as a generic public discovery network. It should first become the fastest way for a private group to make a decision together.

## Core product loop

```text
Recommend -> discuss -> vote -> choose -> watch/play/try -> mark done -> rate -> remember
```

Every near-term feature should support one of those steps.

## Near-term user journey

1. A user creates a clique or joins one by invite.
2. The user adds three recommendations with short reasons.
3. Friends vote, react, or comment.
4. The clique starts a decision session.
5. CliqueBase chooses or helps the group choose one item.
6. Members mark the item done and rate it afterward.
7. The clique gets useful memory: what worked, who liked what, and what should be next.

## MVP acceptance criteria

A fresh user should be able to complete this flow in one session:

- Create an account or use the local demo mode.
- Create or join a clique.
- Add at least three recommendations.
- Invite at least one friend.
- Vote on recommendations.
- Use TonightMode or a poll to choose one item.
- Mark the chosen item done.

## Feature priority rules

Prioritize a feature when it helps answer:

> What should our group watch, play, or try next?

Deprioritize a feature when it mainly serves broad public discovery, passive browsing, or abstract social graph growth.

## Phase 1: core decision loop

Build the minimum loop that makes cliques useful even with only two or three people.

Required capabilities:

- Recommendation notes with title, type, reason, mood tags, context, priority, target, and status.
- Clique-level decision sessions for nominating, voting, choosing, marking selected, marking done, and rating afterward.
- Empty states that push users toward the next action.
- TonightMode logic that picks from unfinished, eligible, supported recommendations.
- Clear distinction between personal library, clique backlog, and active decision session.

## Phase 2: social and invite loop

Turn recommendations into acquisition and reactivation moments.

Required capabilities:

- Request-based friendship everywhere.
- Friend request inbox and outgoing requests.
- Notification drawer with unread count and direct actions.
- Shareable recommendation and decision links.
- Invite landing pages that explain the clique or recommendation before signup.

Target viral loop:

```text
recommendation created -> share link/card -> friend opens -> friend votes/comments/saves -> friend joins clique
```

## Phase 3: taste engine

Make recommendations feel ranked and explainable instead of chronological.

Ranking inputs:

- Friend affinity.
- Clique relevance.
- Recency.
- Number of interested friends.
- Availability match.
- Mood or context match.
- Already completed, rejected, or stale penalties.

The app should be able to explain why it surfaced or selected an item.

## Phase 4: public community layer

Only expand public discovery after the private-clique loop works.

Required safeguards:

- Public profile privacy controls.
- Public clique moderation controls.
- Reporting queue and moderation action states.
- Blocking applied consistently across feed, search, comments, profiles, and cliques.
- Rate limits for invites, search, shares, and comments.

## Data model direction

Move toward generic content and social objects before adding many more media-specific tables.

Recommended entities:

- `media_items`
- `recommendations`
- `votes`
- `ratings`
- `comments`
- `activity_events`
- `notifications`
- `decision_sessions`
- `decision_session_items`

Canonical identity should support external and custom sources:

- TMDB IDs for movies/series.
- RAWG or Steam IDs for games.
- YouTube IDs for videos.
- Spotify IDs for music later.
- Manual/custom slugs for unsupported items.

Duplicate handling should be explicit before the library grows.

## Product metrics

Track these before adding more major features:

- Activation: user creates or joins a clique and adds three picks.
- Social activation: user invites at least one friend.
- Recommendation engagement: recommendation receives a vote, comment, or save.
- Decision success: clique chooses an item through a vote or TonightMode.
- Retention: clique has activity in week two.
- Viral coefficient: invites sent per active clique.
- Time to first decision: signup to first chosen item.

## Mobile and sharing requirements

CliqueBase should assume most decisions happen on phones and inside chat apps.

Requirements:

- Mobile-first navigation audit.
- PWA install metadata.
- Deep links into cliques, recommendations, and decision sessions.
- Share-sheet-friendly URLs and metadata.
- Fast mobile add flow.

## Import and export

Users already have taste data elsewhere. Design for later imports now.

Future import targets:

- Letterboxd.
- IMDb/watchlists.
- Steam wishlist.
- CSV or manual paste.

Export should be available for personal data and owner/admin clique data.

## Engineering implications

Near-term engineering should prefer small, composable modules over another large UI file.

Recommended direction:

- Keep product logic in reusable hooks and library functions.
- Keep recommendation, activity, notification, and decision-session concepts separate.
- Add tests around ranking, deduping, visibility, and decision-session state changes.
- Document Supabase migration order whenever schema changes are added.
