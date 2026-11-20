# Performance checklist

What to check before the live demo (~100+ people posting at once). Why the system is built this way: [DESIGN.md → Load during the demo](DESIGN.md#load-during-the-demo).

## 1. A few days before

### Render
- [ ] The web service is on the **`standard`** plan (1 CPU / 2GB) or larger, with **1 instance**. More instances break the demo, because state lives in one process's memory.
- [ ] Environment: `FAKE_LLM=0`, `AGENT_COUNT=1000`, `CONCURRENCY=1000`, `FEEDBACK_CONCURRENCY=30`, `REFRESH_MS=1000`, and `ANTHROPIC_API_KEY` is set.
- [ ] The deploy log shows `sim ready: 1000 agents, ... model claude-haiku-5-5`. If it says `FAKE_LLM`, the API key is missing and agents are acting randomly.

### Claude API
- [ ] In the Anthropic Console, the org's rate limits for **Haiku** cover one round: ~750 requests within a few seconds, ~3,000 requests per minute, and the matching input and output tokens per minute. Ask for a higher limit if needed.
- [ ] **Sonnet** limits cover ~30 requests in parallel (feedback during the reveal).
- [ ] The org has enough credit or spend limit for rehearsals plus the demo.

## 2. Full rehearsal (real API, production URL)

Run it from a laptop with a good connection:

```bash
npm run simulate -- --users 150 --seconds 5 --url https://<service>.onrender.com
```

Pass if:
- [ ] The script reports `failures: 0`.
- [ ] `GET p95` stays under ~1s.
- [ ] In `/admin` → `lastRound`, `rateLimited` and `timedOut` are close to 0 (under ~5% of `sessions`). The server log warns when more than 5% fail.
  - `rateLimited` high → raise the Claude rate limit.
  - `timedOut` high → the server or the API is slow. Check Render CPU, or raise `SESSION_TIMEOUT_MS`.
- [ ] `lastRound.ms` stays under 15s, so rounds do not skip.
- [ ] About a minute after the last post, every simulated post has feedback (`feedbackStatus` is `done`, not `error` or `pending`).
- [ ] Render metrics: CPU and memory have headroom during the burst.

Also check on real phones:
- [ ] Join by QR code on the **venue Wi-Fi** and on mobile data. The timeline should update live. If the venue blocks WebSockets, Socket.IO falls back to polling and pages still refetch every 20s.
- [ ] Toast notifications and the My Posts feedback appear on a phone.

## 3. On the day

- [ ] **Do not deploy** after the final check. A deploy restarts the process mid-demo. State is restored from Postgres, but clients reconnect and any round in progress is lost.
- [ ] The daily request cap (`DAILY_REQUEST_CAP`, 200,000) is not used up by rehearsals: check `room.requestCount` in `/admin`. A round costs ~750 requests. The count resets at **midnight UTC** (10–11am in eastern Australia), not local midnight.
- [ ] Right before the demo: `/admin` → **Reset**. This clears rehearsal posts and events, so the saved snapshot stays small, and re-seeds the agents.
- [ ] `/admin` shows the room is not paused.
- [ ] Keep `/admin` open on a laptop during the demo. If rounds look empty, check `lastRound.failed` first.

## If something goes wrong live

| Symptom | Likely cause | What to do |
|---|---|---|
| Few or no reactions, low scores | Claude rate limit (`rateLimited` > 0) | Tell the room it is a small sample. Next time, raise the limit or lower `AGENT_COUNT`. |
| Timeline updates late | Server CPU saturated | Wait it out: the 1s throttle catches up. Scale the Render plan up for next time. |
| Feedback missing at the reveal | Sonnet slow or limited | Show the #1 post's engagement breakdown first. Feedback arrives as a toast when ready. |
| "Wait Ns before posting again" | 5s post cooldown per member | Expected. |
