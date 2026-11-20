# Design

How we build what [PRODUCT.md](PRODUCT.md) describes. Rules (feed slots, scoring, etc.) live in PRODUCT.md and are not repeated here.

## Architecture

```
┌────────────── Browser: phone or big screen (same app) ───────────────┐
│  Room tabs: Timeline (default) / Dashboard / My Posts                │
└─────────┬────────────────────────────────────────▲───────────────────┘
          │ join, post (HTTP)                      │ timeline, leaderboard,
          ▼                                        │ notifications (WebSocket)
┌─────────┴────────── Render: one Node.js process ─┴───────────────────┐
│                                                  │                   │
│  Next.js: pages + API routes         Socket.IO: realtime push        │
│   checks length, cooldown, filter                ▲                   │
│         │                                        │ round results     │
│         ▼                                        │                   │
│  In-memory state  ◀────────────────▶  Round engine (every 15s)       │
│         │    ▲                         build feeds, run sessions,    │
│         │    │                         apply events, score, finalize │
│         │    │                                   │                   │
│         │  Feedback worker  ◀── finalized posts ─┤                   │
│         │         │                              │                   │
└─────────┬─────────┬──────────────────────────────┬───────────────────┘
          │         │                              │
          ▼         ▼                              ▼
   Render Postgres  Claude Sonnet 5.5       Claude Haiku 5.5
   save each round, post feedback           agent sessions,
   load on restart                          1,000 parallel / round
```

- The round engine works on in-memory state for speed. The whole room is saved to Postgres as one snapshot after each round (and a few seconds after joins and posts), and loaded on restart.
- Run a single instance with no autoscaling, on a paid plan so it does not sleep.
- The round engine runs on the server, not in serverless functions, because it calls the API 1,000 times every 15s.

## Tech stack
- TypeScript, Next.js with a custom server (`server.ts`), so the UI, the API, Socket.IO and the engine run in one process.
- Tailwind for UI; `react-force-graph-2d` for the network spread view.
- `@anthropic-ai/sdk`. Agents: `claude-haiku-5-5`, thinking off. Feedback: `claude-sonnet-5-5`.
- `p-limit` to cap concurrent API calls.
- Render Postgres via plain `pg`: one `snapshots` table, one `jsonb` row per room.
- Render web service. `ANTHROPIC_API_KEY` as an env var (never committed).

## Data (Postgres, cached in memory)
Saved together as one `jsonb` snapshot per room (shapes live in `src/engine/types.ts`).
```ts
Room    { id, topic, round, paused, running, lastRoundMs, requestDay, requestCount }
Member  { id, nickname, followerIds: AgentId[], lastPostAt }
Agent   { id, handle, persona: { age, region, role, leaning, interests, activity, openness },
          stance /* 0-100 */, followingIds: (AgentId | MemberId)[], followerIds: AgentId[] }
Post    { id, authorType: "agent" | "member", authorId, text, side: "for" | "against" | "neutral",
          createdRound, roundsSeen, counts: { like, repost, reply, follow, unfollow, persuasion,
          backlash, neutralShift, impressions }, points, finalized, feedback?, feedbackStatus }
Event   { id, round, agentId, type: "like" | "repost" | "reply" | "follow" | "unfollow" |
          "persuasion" | "backlash" | "neutralShift", postId, viaId? /* reposter, for the spread graph */,
          text?, stanceBefore?, stanceAfter? }
```
- `agents.json` (1,000 personas) is generated once before the demo and loaded at startup.
- `events` is the engagement log. Points, notifications and feedback are all computed from it.

## Logic
| Module | Job |
|---|---|
| `seed` | Load `agents.json`. Build a power-law follow graph between agents. Give each new member 100 random agent followers. |
| `roundEngine` | Every 15s: skip if the previous round is still running, then run the steps below and increment `round`. Runs only while some human post is not final yet: starts on a member's post, stops when the last one is final (saves API budget). Stops for the day at a daily request cap (config). |
| `feedBuilder` | Build each agent's 12-post feed (follows / exploration / `rank`). Drop posts older than 4 rounds. |
| `sessionRunner` | One Haiku request per agent. Shared rules and tools first (prompt cache), then persona, stance and feed. Post text is wrapped as data. 10s timeout. |
| `applyEvents` | Validate tool calls (post must be in that agent's feed, max 3 replies), append events, update counts, follows and stance. |
| `scorer` | Add points per PRODUCT.md. Check Persuasion / Backlash from `end_session`. |
| `finalizer` | Mark posts that have been through 4 rounds as final and queue them for feedback. |
| `feedbackWorker` | One Sonnet request per finalized human post, built from its events. |
| `broadcaster` | Push the timeline update and leaderboard to everyone, and notifications to each member. |

**API**
- `POST /api/rooms/:id/join` → member id (nickname)
- `POST /api/rooms/:id/posts` → checks length, 10s cooldown, word filter
- `GET /api/rooms/:id` → current state (on page load)
- `GET /api/rooms/:id/spread/:postId` → nodes and links for the spread graph
- `/admin` (`ADMIN_TOKEN`): pause, resume, run a round now, reset room. Agent count is set with `AGENT_COUNT` + reset.
