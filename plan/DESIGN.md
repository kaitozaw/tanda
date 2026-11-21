# Design

How we build what [PRODUCT.md](PRODUCT.md) describes. Rules (audience mix, feed slots, signals, scoring, etc.) live in PRODUCT.md and are not repeated here.

## Architecture

```
┌────────────── Browser: phone or big screen (same app) ───────────────┐
│  Home: market list (one open, others "Coming soon")                  │
│  Room tabs: Timeline (default) / Dashboard / My Pitches              │
│  On "refresh": wait 0-0.5s, then GET state. One GET at a time;       │
│  pushes during a GET become one follow-up GET.                       │
└───┬──────────────────▲─────────────────────────────▲─────────────────┘
    │ join, pitch      │ GET state                   │ "refresh" (room, ≤1/s)
    │ (HTTP)           │ (HTTP)                      │ notify, feedback (member)
    ▼                  │                             │ (WebSocket)
┌───┴──────────────────┴─── Render: one Node.js process, standard plan ┐
│                                                    │                 │
│  Next.js: pages + API routes           Socket.IO + broadcaster       │
│   join; pitch: length, word filter,    throttles "refresh" to one    │
│   5s cooldown per member               push per second per room      │
│         │                                          ▲                 │
│         │ every write asks for a refresh ──────────┤                 │
│         ▼                                          │                 │
│  In-memory state  ◀────────────────▶  Round engine (every 15s)       │
│         │    ▲                         build feeds, run sessions,    │
│         │    │                         apply events, score, finalize │
│         │    │                                     │                 │
│         │  Feedback worker  ◀── finalized pitches ─┤                 │
│         │  (30 parallel)                           │                 │
└─────────┬─────────┬────────────────────────────────┬─────────────────┘
          │         │                                │
          ▼         ▼                                ▼
   Render Postgres  Claude Sonnet 5.5         Claude Haiku 5.5
   save each round, pitch feedback            agent sessions,
   load on restart                            up to 1,000 parallel / round
```

- The architecture is unchanged: one open room, one round engine, state in memory. Markets that are "Coming soon" exist only as config and a card on the home page. They have no store, no agents and no rounds.
- The round engine works on in-memory state for speed. The whole room is saved to Postgres as one snapshot after each round (and a few seconds after joins and posts), and loaded on restart.
- Run a single instance with no autoscaling (state lives in memory), on Render `standard` (1 CPU / 2GB) so it does not sleep and has headroom for the demo burst.
- The round engine runs on the server, not in serverless functions, because it calls the API 1,000 times every 15s.

### Load during the demo
The worst moment is ~100+ people pitching within a few seconds, then many pitches finalizing in the same round.
- **Refresh fan-out.** Every client refetches the room on each `refresh` push, so pushing on every post would cost posts × clients GETs (100 × 100 = 10,000). The broadcaster sends at most one `refresh` per room per `REFRESH_MS` (1s): the first goes out at once and later ones in the window merge into one trailing push. Clients add 0–0.5s jitter and run one GET at a time. Feedback completions go through the same throttle, so the reveal does not cause a second spike.
- **Agent load follows live pitches, not people.** Only agents with a pitch to see run a session. A pitch costs about 150 sessions in its first round and 20–300 in each later round (per 1,000 agents), so roughly 200–1,050 sessions over its life, shared when pitches overlap (up to 3 per feed). A quiet room costs nothing.
- **Feedback.** Pitches made in the same 15s finalize together, so the worker runs 30 Sonnet requests in parallel (`FEEDBACK_CONCURRENCY`) to have them ready within the 1-minute reveal.
- **Claude rate limits.** A round is ~750 Haiku requests within seconds (~3,000 per minute). Failed sessions count as "no action" without retrying, so `/admin` → `lastRound` splits `failed` into `rateLimited` (raise the org limit) and `timedOut`. The server logs a warning when more than 5% fail.
- **Spam.** One pitch per member per 5s (`429` otherwise), so one person cannot flood the room.
- **Rehearsal.** `npm run simulate -- --users 150 --seconds 5` opens a socket per fake member that refetches like a phone, so it measures the fan-out, not just the POSTs. With FAKE_LLM on a laptop: 120 users in 10s → 1,560 GETs (was 14,640); 200 users in 3s → 0 failures (connections timed out before).

## Tech stack
- TypeScript, Next.js with a custom server (`server.ts`), so the UI, the API, Socket.IO and the engine run in one process.
- Tailwind for UI.
- `@anthropic-ai/sdk`. Agents: `claude-haiku-5-5`, thinking off. Feedback: `claude-sonnet-5-5`.
- `p-limit` to cap concurrent API calls.
- Render Postgres via plain `pg`: one `snapshots` table, one `jsonb` row per room.
- Render web service. `ANTHROPIC_API_KEY` as an env var (never committed).

## Markets (`markets.ts`, replaces `rules.roomId` / `rules.topic`)
```ts
Market { id, name, status: "open" | "coming_soon", region, summary /* ≤600 chars: economy, culture,
         incumbents, rules — the macro attributes agents share */ }
```
| id | name | status |
|---|---|---|
| `au` | Australian market | `open` (the room the engine runs) |
| `jp` | Japanese market | `coming_soon` |
| `global-b2b-saas` | Global B2B SaaS | `coming_soon` |

The open market's id is the room id. Only it has `data/rooms/<id>/` and a store.

## Data (Postgres, cached in memory)
Saved together as one `jsonb` snapshot per room (shapes live in `src/engine/types.ts`).
```ts
Room    { id /* market id */, round, paused, running, lastRoundMs, requestDay, requestCount }
Member  { id, nickname, handle, followerIds: AgentId[], joinedAt }
Agent   { id, handle, persona: Persona, followingIds: (AgentId | MemberId)[], followerIds: AgentId[] }
Persona { market /* market id */, name, age, region, tier: "power" | "crowd",
          segment: "customer" | "investor" | "industry_lead" | "regulator" | "media",
          role, group /* persona label only */, priorities: string[], adoption, priceSensitivity, scepticism,
          activity, openness /* 0-1 each */, bio }
Post    { id, authorType: "agent" | "member", authorId, text, createdRound, roundsSeen,
          seenBy: AgentId[] /* pitches only, unique */, audienceByRound: number[] /* new viewers per round */, counts: Counts, points, finalized,
          feedback?, feedbackStatus }
Counts  { like, repost, reply, follow, unfollow, intent, objection, impressions }
Event   { id, round, agentId, type: keyof Counts (except impressions), postId,
          text? /* reply text or signal reason */ }
```
- Removed from main: `Room.topic`, `Agent.stance`, `Persona.leaning` / `interests`, `Post.side`, `neutralShift`, `Event.stanceBefore` / `stanceAfter`. A member post is a pitch; there is no `isPitch` flag.
- `seenBy` is kept for pitches only. Feedback needs to know *which* agents saw a pitch (e.g. "how many investors saw it" next to how many signalled `intent`), and storing that for every agent post would be wasteful.
- `data/rooms/<roomId>/agents.json` (1,000 personas for that market) is generated once before the demo and loaded at startup. It moves from `data/agents.json` so each market has its own.
- `data/rooms/<roomId>/posts.json` holds the room's starter posts (`{ segment, text }`; ~20 for `au`: everyday life and work in Australia, no pitches). They are added on a fresh seed and on reset, and are the **background** of every agent's feed: they never finalize and agents' actions on them are ignored, so the surroundings of a pitch are the same at any time. Each is posted by a different agent of that segment. A room without the file starts empty.
- `events` is the engagement log. Points, notifications and feedback are all computed from it.

## Audience generation (`scripts/generate-agents.ts`)
Same script as main, run once per market: `npm run agents:generate -- --market au`.
- Code builds the personas from the market's rule tables: the PRODUCT.md mix by segment, customer groups with shares, power-tier groups (archetypes) per segment, regions, and ranges for the numeric traits. The Australian tables live in the script.
- Haiku writes bios in batches as today, with the market's `summary` as context; a template from role + priorities is used without a key or with `--no-llm`.
- `seed` builds the follow graph at startup with power accounts placed first in the power law, so they collect the most followers. Then media follow everyone in the power tier and investors follow industry leads.

## Agent prompt (`prompts.ts`)
Three layers, ordered so the shared parts are cached:
1. **Tools + system rules:** the same for every agent. The PRODUCT.md realism rules, what each signal means, and the prompt-injection guard. Cache breakpoint.
2. **Market context:** the market's `name` and `summary`. The same for every agent in the room. Cache breakpoint.
3. **User message:** persona, what each signal means for this agent's segment, and the feed. Pitches are marked `pitch="yes"`.

Tools: `like`, `repost`, `reply`, `follow` and `unfollow` (agents do not write posts), plus `intent(post_id, reason)` and `objection(post_id, reason)`. The schemas are the same for every agent, so they stay cacheable; what each signal means for this agent's segment (`rules.signals`) is in the user message.

## Logic
| Module | Job |
|---|---|
| `seed` | Load the room's `agents.json`. Build the power-law follow graph (power tier first, then the PRODUCT.md extras). Add the room's starter posts. Give each new member 100 random crowd followers. |
| `roundEngine` | Every 15s: skip if the previous round is still running, then run the steps below and increment `round`. Runs only while some pitch is not final yet: starts on a member's pitch, stops when the last one is final (saves API budget). Stops for the day at a daily request cap (config). |
| `feedBuilder` | Exposure planning (PRODUCT.md → Round): each live pitch's new viewers this round, sized only by its own last-round reaction rate (round 1: author's followers + a random sample, unreachable followers replaced at random), word of mouth first; at most 3 pitches per agent. Each agent with a pitch gets a 12-post feed filled with background (starter) posts. Pitches are processed in random order. |
| `sessionRunner` | One Haiku request per agent with a feed (agents with no pitch to see are skipped), three-layer prompt (above). Post text is wrapped as data. 10s timeout. |
| `applyEvents` | Validate tool calls: only pitches in that agent's feed count (actions on background posts are ignored, so they never change); max 3 replies; signals max 2, one per kind per agent and pitch, `reason` cut to 20 words. Append events, update counts and follows. |
| `scorer` | Add points per PRODUCT.md: engagement by the acting agent's tier, intent by its segment, objections 0 (`pointsFor`). The score is the sum. |
| `finalizer` | Mark posts that have been through 4 rounds as final and queue pitches for feedback. |
| `scorecard` | Pure function: the feedback numbers (views, reach, reaction rate, and per segment: saw, reacted, intent, objection) from a pitch's events and `seenBy`. Used by the Dashboard and fed to feedback. |
| `feedbackWorker` | One Sonnet request per finalized pitch: market context + pitch + scorecard + its events → forced tool returning `{ verdict, landedWith, objections[3], improvements, rewrite, nextStep }`. 30 in parallel. |
| `broadcaster` | Tell everyone in the room to refetch (throttled to one push per second), and push notifications and feedback-ready to each member. |

**API**
- The home page reads the market list from `markets.ts` directly (server component), so there is no markets API.
- `POST /api/rooms/:id/join` → member id (nickname). `404` for any id but the open market's (so `coming_soon` markets cannot be joined).
- `POST /api/rooms/:id/posts` → pitch. Checks length, word filter, 5s cooldown per member.
- `GET /api/rooms/:id` → current state (on page load and on every refresh push). The leaderboard lists every pitch with light rows only.
- `GET /api/rooms/:id/posts/:postId` → the post's replies and, for a pitch, its public results (`scorecard`, `breakdown`, `feedback`, `feedbackStatus`).
- `/admin` (`ADMIN_TOKEN`): status, pause, resume, reset room. Agent count is set with `AGENT_COUNT` + reset.

## UI
| Screen | Content |
|---|---|
| **Home** | One card per market. The open one links to its room; `coming_soon` ones are greyed out and not clickable. No room creation. |
| **Timeline** | Market header (name + one-line summary), the live feed and the pitch composer. Pitches carry a "Pitch" badge. |
| **Dashboard** | Counts (agents, people, pitches, reactions), the audience by segment, and the leaderboard of **every** pitch (light rows: points, reach, intent, objections). Opening a row loads that pitch's scorecard, breakdown and **feedback** from `GET /api/rooms/:id/posts/:postId`, so any team can read any other team's results. |
| **My Pitches** | Each of my pitches with its score, scorecard, activity log (who did what, with signal reasons; signals are visible only to the author), and feedback once final. Tab badge for unread reactions. |

Every scorecard and report shows the label "Simulated audience. Use it to decide what to test for real."
