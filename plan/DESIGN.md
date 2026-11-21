# Design

How we build what [PRODUCT.md](PRODUCT.md) describes. Rules (audience mix, signals, points, scorecard) live in PRODUCT.md and are not repeated here.

## Architecture

```
┌────────────── Browser: phone or big screen (same app) ───────────────┐
│  Home: create a room / open a link                                   │
│  Room tabs: Timeline (default) / Dashboard / My Pitches              │
│  On "refresh": wait 0-0.5s, then GET state. One GET at a time.       │
└───┬──────────────────▲─────────────────────────────▲─────────────────┘
    │ create, join,    │ GET state                   │ "refresh" (room, ≤1/s)
    │ post (HTTP)      │ (HTTP)                      │ notify, feedback (member)
    ▼                  │                             │ (WebSocket)
┌───┴──────────────────┴─── Render: one Node.js process, standard plan ┐
│                                                                      │
│  Next.js: pages + API routes           Socket.IO + broadcaster       │
│   create room, join, post              throttles "refresh" to one    │
│         │                              push per second per room      │
│         ▼                                          ▲                 │
│  Audience generator ──▶ Rooms: Map<roomId, Store>  │                 │
│  plan → instantiate          ▲    (in memory)      │                 │
│  → bios → follow graph       │                     │                 │
│                              ▼                     │                 │
│                   Scheduler (every 15s) ─▶ Round engine per room     │
│                   active rooms only,       feeds, sessions, events,  │
│                   shared API limiter       points, finalize          │
│                              │                     │                 │
│                   Feedback worker ◀── finalized pitches              │
│                   (30 parallel)                                      │
└─────────┬─────────┬────────────────────────────────┬─────────────────┘
          ▼         ▼                                ▼
   Render Postgres  Claude Sonnet 5.5         Claude Haiku 5.5
   one snapshot     audience plan,            agent sessions, bios
   per room         pitch feedback
```

- **Multiple rooms.** The single global `Store` becomes `Map<roomId, Store>`. Each room has its own audience, posts, events and round counter.
- **One scheduler, shared limits.** Every 15s the scheduler runs a round for each **active** room, meaning one with a pitch still waiting for its final score. All rooms share one `p-limit` (`CONCURRENCY`) so the total load on Claude is capped across rooms. If a room's previous round is still running, that room skips this tick (same rule as today).
- **State in memory, snapshot to Postgres.** One `jsonb` row per room, saved after each round and a few seconds after joins and posts. Every room is loaded on restart. Run one instance with no autoscaling, on Render `standard`.

## Room lifecycle

```
POST /api/rooms ──▶ status "generating" ──▶ "ready" ──▶ active while a pitch is pending ──▶ idle
                     plan → agents → bios → graph      (rounds run)                         (no rounds)
                     (~15s, progress pushed)
```

Members can open and join a room while it is `generating`. The Timeline shows "Building your audience…" with the plan's segments as they arrive. Posting opens at `ready`.

## Audience generator (`audience.ts`, new)
Replaces `data/agents.json`, which was 1,000 fixed personas loaded at startup. `scripts/generate-agents.ts` and the hard-coded `rules.topic` / `rules.roomId` are retired.

| Step | How | Failure handling |
|---|---|---|
| **1. Plan** | One Sonnet request with a single forced tool (`audience_plan`, strict JSON schema) from the room's title, kind, description, region and `targetHint`. | Validate in code: segment shares sum to 100, a sceptics segment exists, every power type has ≥3 archetypes, ranges are within 0–100 / 0–1. Retry once. If it fails again, use `DEFAULT_PLAN` (generic segments; no LLM). |
| **2. Instantiate** | Code only. Counts per type and segment come from the PRODUCT.md mix × the plan's shares. Names, handles, ages and regions come from local lists. `stance`, `scepticism`, `openness` and `activity` are drawn from the plan's ranges. RNG is seeded from the room id, so a rebuild is reproducible. | — |
| **3. Bios** | Haiku, 50 agents per request, 20 requests in parallel. Each returns `{ id, bio }[]`. | Any batch that fails or times out gets template bios: `"{role}. Cares about {priorities}."` |
| **4. Follow graph** | `buildFollowGraph` (existing, preferential attachment) with power accounts placed first so they collect the most followers. Then the PRODUCT.md extras: media follow the power tier, investors follow industry leads. | — |

Each step's result is saved on the room so the UI can show progress and a restart resumes from the last finished step. Cost per room: 1 Sonnet + 20 Haiku requests.

`AGENT_COUNT` scales the whole mix down proportionally (e.g. 300 for local dev). Every type keeps at least a few agents.

## Agent sessions (`prompts.ts`, `sessionRunner.ts`)
The prompt has three layers, ordered so the shared parts can be cached:
1. **Tools + system rules:** the same for every room. Includes the PRODUCT.md realism rules and the prompt-injection guard. Cache breakpoint.
2. **Room context:** the idea card (title, kind, description, region). The same for every agent in the room. Cache breakpoint.
3. **User message:** persona (type, role, segment, priorities, scepticism, openness, activity, bio), current stance ("support for this idea"), the signal kinds this agent may use, may-post flag, and the feed.

Pitches are marked `<post … pitch="yes">` in the feed and point to the idea card in layer 2. That avoids repeating the description in every post.

Tools: the existing `like`, `repost`, `reply`, `follow`, `unfollow`, `post` and `end_session`, plus `signal(post_id, kind, reason)`, where `kind` is an enum of all nine kinds. The schema stays identical across agents so it stays cacheable. The allowed kinds for this agent are listed in the user message and enforced in `applyEvents`.

## Data (Postgres, cached in memory)
One `jsonb` snapshot per room (shapes live in `src/engine/types.ts`).
```ts
Room    { id, title, kind: "product" | "feature" | "decision", description, region, targetHint?,
          status: "generating" | "ready" | "error", audiencePlan, round, paused, running,
          lastRoundMs, createdAt }
Member  { id, nickname, handle, followerIds: AgentId[], joinedAt }
Agent   { id, handle, persona: Persona /* see PRODUCT.md */,
          stance /* 0-100 support for the idea */, followingIds, followerIds }
Post    { id, authorType: "agent" | "member", authorId, text, isPitch,
          createdRound, roundsSeen, seenBy: AgentId[] /* pitches only, unique */,
          counts: Counts, points, finalized, feedback?, feedbackStatus }
Counts  { like, repost, reply, follow, unfollow, impressions, impressionsViaRepost,
          would_try, would_pay, want_meeting, pass, partner, compete, support, concern,
          would_cover, objection, persuasion, backlash }
Event   { id, round, agentId, type: EngagementType | SignalKind | "persuasion" | "backlash",
          postId, text? /* reply text or signal reason */, stanceBefore?, stanceAfter? }
```
- `Side` and `neutralShift` are removed. Every pitch is trying to raise support for the idea.
- `seenBy` is kept for pitches only. The scorecard needs to know *which* agents saw a pitch (e.g. "target-segment customers who saw it"), and storing that for every agent post would be wasteful.
- The daily request counter moves from `Room` to a process-wide counter, since the cap is shared.
- `events` is still the engagement log. Points, scorecard, notifications and feedback are all computed from it.

## Logic
| Module | Job | Change |
|---|---|---|
| `audience` | Plan → instantiate → bios → follow graph (see above). | **New** |
| `rooms` | `Map<roomId, Store>`: create, get, list active, load all on boot, save snapshots. | **New** (from `store.ts` global + `runtime.ts`) |
| `scheduler` | Every 15s, start a round for each active room that is not already running. Shares one limiter and the daily request cap. | **New** (from `roundEngine` timer) |
| `seed` | Give each new member 100 random **crowd** followers. | Agent loading moves to `audience` |
| `roundEngine` | One round for one room: pick posters, build feeds, run sessions, apply events, score, finalize. | Takes a room instead of the global store |
| `feedBuilder` | 12-post feed (follows / exploration / `rank`). Drop posts older than 4 rounds. Add each feed viewer to the pitch's `seenBy` and count `impressionsViaRepost`. | Small |
| `sessionRunner` | One Haiku request per online agent, three-layer prompt, 10s timeout. | Prompt layers |
| `applyEvents` | Validate: post is in that agent's feed, max 3 replies, max 2 signals, signal kind allowed for the agent's type, `reason` cut to 20 words. Append events, update counts, follows, stance. | Adds signals |
| `scorer` | Points from the PRODUCT.md table, chosen by the agent's tier. Persuasion / backlash from `end_session` and `influenced_by`, for pitches only. | New table in `config.rules.points` |
| `scorecard` | Builds the PRODUCT.md scorecard for a pitch from its events + `seenBy`. Pure function. Used by the Dashboard and fed to feedback. | **New** |
| `finalizer` | Mark pitches that have been through 4 rounds as final and queue them for feedback. | — |
| `feedbackWorker` | One Sonnet request per finalized pitch: idea card + pitch + scorecard + its events → forced tool returning `{ verdict, objections[3], champions[], blockers[], byStakeholder, rewrite, nextStep }`. 30 in parallel. | New output shape |
| `broadcaster` | Throttled per-room refresh. Member notifications and feedback-ready. Adds audience-progress pushes during `generating`. | Small |

## API
- `POST /api/rooms` → `{ id }`. Body: title, kind, description, region, targetHint. Checks lengths and the word filter, enforces `MAX_ROOMS`, starts audience generation in the background.
- `GET /api/rooms/:id` → room state, including `status`, the audience summary (counts per type and segment) and scorecards.
- `POST /api/rooms/:id/join` → member id (nickname).
- `POST /api/rooms/:id/posts` → pitch. Rejected until `status = ready`. Checks length, word filter, 5s cooldown per member.
- `/admin` (`ADMIN_TOKEN`): list rooms. Per room: pause, resume, run a round now, reset (deletes posts and audience, then regenerates).

## UI
| Screen | Content |
|---|---|
| **Home** | "Test an idea" form (title, kind, description with a 600-char counter, region, optional target customer) and a field to paste a room link. |
| **Timeline** | Idea card pinned at the top, the live feed and the pitch composer. Pitches show the card as a link preview. While generating: audience build progress. |
| **Dashboard** | Room counts. An **Audience** panel (agents per type and segment, from the plan). The leaderboard of pitches with scorecard columns side by side (the A/B view). Tap a row for the full scorecard and breakdown. |
| **My Pitches** | Each of my pitches with score, scorecard, activity log (who did what, with signal reasons) and feedback once final. Tab badge for unread reactions. |

Every scorecard and report shows the label "Simulated audience. Use it to decide what to test for real."

## Load and limits
- **Agent load per active room:** about 750 Haiku requests per round (online share of 1,000), independent of how many people post. Load grows with **active rooms**, not with people.
- **`MAX_ACTIVE_ROOMS`** (default 3): at most this many rooms run rounds at once. Other rooms with pending pitches wait their turn, and the UI says "queued". Three active rooms means about 2,250 requests per 15s (about 9,000 per minute). Check the org rate limit before the event and lower `AGENT_COUNT` or `MAX_ACTIVE_ROOMS` if needed.
- **`MAX_ROOMS`** (default 20): total rooms kept, to bound memory and snapshot size (about 1MB per room with bios and graph).
- **Room creation:** 1 Sonnet + 20 Haiku requests per room. It runs through the same limiter, ahead of sessions so a new room becomes ready quickly.
- **Refresh fan-out:** unchanged. At most one `refresh` per room per `REFRESH_MS` (1s), with client jitter and one GET at a time.
- **Feedback:** 30 Sonnet requests in parallel (`FEEDBACK_CONCURRENCY`), so pitches posted together have reports within a minute of finalizing.
- **Failures:** failed sessions count as "no action" without retry. `/admin` → `lastRound` per room splits `failed` into `rateLimited` and `timedOut`. A warning is logged above 5%.
- **Spam:** one post per member per 5s (`429` otherwise).
- **Rehearsal:** `npm run simulate` gains `--rooms N` to create N rooms and post into each, so it measures cross-room load as well as fan-out.

## Fake mode (`FAKE_LLM=1`)
No API key needed. The plan comes from `DEFAULT_PLAN`, bios from the template, sessions from the existing random actor (now also emitting signals allowed for the agent's type), and feedback from a canned report filled with real scorecard numbers.

## Tech stack
- TypeScript, Next.js with a custom server (`server.ts`). UI, API, Socket.IO and engine run in one process.
- Tailwind for UI.
- `@anthropic-ai/sdk`. Agents and bios: `claude-haiku-5-5`, thinking off. Audience plan and feedback: `claude-sonnet-5-5`. Structured output through forced, strict tools.
- `p-limit`: one shared limiter for all Claude calls.
- Render Postgres via plain `pg`: one `snapshots` table, one `jsonb` row per room.
- Render web service. `ANTHROPIC_API_KEY` as an env var, never committed.
