# Design

How we build what [PRODUCT.md](PRODUCT.md) describes. Rules (feed slots, scoring, etc.) live in PRODUCT.md and are not repeated here.

## Architecture

```
┌────────────── Browser: phone or big screen (same app) ───────────────┐
│  Room tabs: Timeline (default) / Dashboard / My Posts                │
│  On "refresh": wait 0-0.5s, then GET state. One GET at a time;       │
│  pushes during a GET become one follow-up GET.                       │
└───┬──────────────────▲─────────────────────────────▲─────────────────┘
    │ join, post       │ GET state                   │ "refresh" (room, ≤1/s)
    │ (HTTP)           │ (HTTP)                      │ notify, feedback (member)
    ▼                  │                             │ (WebSocket)
┌───┴──────────────────┴─── Render: one Node.js process, standard plan ┐
│                                                    │                 │
│  Next.js: pages + API routes           Socket.IO + broadcaster       │
│   join; post: length, word filter,     throttles "refresh" to one    │
│   5s cooldown per member               push per second per room      │
│         │                                          ▲                 │
│         │ every write asks for a refresh ──────────┤                 │
│         ▼                                          │                 │
│  In-memory state  ◀────────────────▶  Round engine (every 15s)       │
│         │    ▲                         build feeds, run sessions,    │
│         │    │                         apply events, score, finalize │
│         │    │                                     │                 │
│         │  Feedback worker  ◀── finalized posts ───┤                 │
│         │  (30 parallel)                           │                 │
└─────────┬─────────┬────────────────────────────────┬─────────────────┘
          │         │                                │
          ▼         ▼                                ▼
   Render Postgres  Claude Sonnet 5.5         Claude Haiku 5.5
   save each round, post feedback             agent sessions,
   load on restart                            up to 1,000 parallel / round
```

- The round engine works on in-memory state for speed. The whole room is saved to Postgres as one snapshot after each round (and a few seconds after joins and posts), and loaded on restart.
- Run a single instance with no autoscaling (state lives in memory), on Render `standard` (1 CPU / 2GB) so it does not sleep and has headroom for the demo burst.
- The round engine runs on the server, not in serverless functions, because it calls the API 1,000 times every 15s.

### Load during the demo
The worst moment is ~100+ people posting within a few seconds, then many posts finalizing in the same round.
- **Refresh fan-out.** Every client refetches the room on each `refresh` push, so pushing on every post would cost posts × clients GETs (100 × 100 = 10,000). The broadcaster sends at most one `refresh` per room per `REFRESH_MS` (1s): the first goes out at once and later ones in the window merge into one trailing push. Clients add 0–0.5s jitter and run one GET at a time. Feedback completions go through the same throttle, so the reveal does not cause a second spike.
- **Agent load does not grow with people.** Each round runs one Haiku session per online agent (~750 of 1,000), however many people post. Human posts only change what is in the feeds.
- **Feedback.** Posts made in the same 15s finalize together, so the worker runs 30 Sonnet requests in parallel (`FEEDBACK_CONCURRENCY`) to have them ready within the 1-minute reveal.
- **Claude rate limits.** A round is ~750 Haiku requests within seconds (~3,000 per minute). Failed sessions count as "no action" without retrying, so `/admin` → `lastRound` splits `failed` into `rateLimited` (raise the org limit) and `timedOut`. The server logs a warning when more than 5% fail.
- **Spam.** One post per member per 5s (`429` otherwise), so one person cannot flood the room.
- **Rehearsal.** `npm run simulate -- --users 150 --seconds 5` opens a socket per fake member that refetches like a phone, so it measures the fan-out, not just the POSTs. With FAKE_LLM on a laptop: 120 users in 10s → 1,560 GETs (was 14,640); 200 users in 3s → 0 failures (connections timed out before).

## Tech stack
- TypeScript, Next.js with a custom server (`server.ts`), so the UI, the API, Socket.IO and the engine run in one process.
- Tailwind for UI.
- `@anthropic-ai/sdk`. Agents: `claude-haiku-5-5`, thinking off. Feedback: `claude-sonnet-5-5`.
- `p-limit` to cap concurrent API calls.
- Render Postgres via plain `pg`: one `snapshots` table, one `jsonb` row per room.
- Render web service. `ANTHROPIC_API_KEY` as an env var (never committed).

## Data (Postgres, cached in memory)
Saved together as one `jsonb` snapshot per room (shapes live in `src/engine/types.ts`).
```ts
Room    { id, topic, round, paused, running, lastRoundMs, requestDay, requestCount }
Member  { id, nickname, handle, followerIds: AgentId[], joinedAt }
Agent   { id, handle, persona: { age, region, role, leaning, interests, activity, openness },
          stance /* 0-100 */, followingIds: (AgentId | MemberId)[], followerIds: AgentId[] }
Post    { id, authorType: "agent" | "member", authorId, text, side: "for" | "against" | "neutral",
          createdRound, roundsSeen, counts: { like, repost, reply, follow, unfollow, persuasion,
          backlash, neutralShift, impressions }, points, finalized, feedback?, feedbackStatus }
Event   { id, round, agentId, type: "like" | "repost" | "reply" | "follow" | "unfollow" |
          "persuasion" | "backlash" | "neutralShift", postId, text?, stanceBefore?, stanceAfter? }
```
- `agents.json` (1,000 personas) is generated once before the demo and loaded at startup.
- `rooms/<roomId>/posts.json` holds the room's starter posts (`{ side, text }`; 20 for `au-u16-ban`). They are added on a fresh seed and on reset, so the timeline is not empty before anyone posts. A room without the file starts empty.
- `events` is the engagement log. Points, notifications and feedback are all computed from it.

## Logic
| Module | Job |
|---|---|
| `seed` | Load `agents.json`. Build a power-law follow graph between agents. Add the room's starter posts, each by a different active agent whose stance matches the post's side. Give each new member 100 random agent followers. |
| `roundEngine` | Every 15s: skip if the previous round is still running, then run the steps below and increment `round`. Runs only while some human post is not final yet: starts on a member's post, stops when the last one is final (saves API budget). Stops for the day at a daily request cap (config). |
| `feedBuilder` | Build each agent's 12-post feed (follows / exploration / `rank`). Drop posts older than 4 rounds. |
| `sessionRunner` | One Haiku request per agent. Shared rules and tools first (prompt cache), then persona, stance and feed. Post text is wrapped as data. 10s timeout. |
| `applyEvents` | Validate tool calls (post must be in that agent's feed, max 3 replies), append events, update counts, follows and stance. |
| `scorer` | Add points per PRODUCT.md. Check Persuasion / Backlash from `end_session`. |
| `finalizer` | Mark posts that have been through 4 rounds as final and queue them for feedback. |
| `feedbackWorker` | One Sonnet request per finalized human post, built from its events. 30 in parallel. |
| `broadcaster` | Tell everyone in the room to refetch (throttled to one push per second), and push notifications and feedback-ready to each member. |

**API**
- `POST /api/rooms/:id/join` → member id (nickname)
- `POST /api/rooms/:id/posts` → checks length, word filter, 5s cooldown per member
- `GET /api/rooms/:id` → current state (on page load)
- `/admin` (`ADMIN_TOKEN`): status, pause, resume, reset room. Agent count is set with `AGENT_COUNT` + reset.
