# Capture the Narrative

Test an idea on 1,000 AI stakeholders (customers, investors, industry leads, regulators, media) and see one simulated hour of reactions in one minute. Each room is one idea with its own generated audience.
Specs: [plan/PRODUCT.md](plan/PRODUCT.md), [plan/DESIGN.md](plan/DESIGN.md), [plan/DEMONSTRATION.md](plan/DEMONSTRATION.md). Before the demo: [plan/PERFORMANCE.md](plan/PERFORMANCE.md).

## Run locally
```bash
npm install
cp .env.example .env          # FAKE_LLM=1 needs no API key
docker compose up -d          # optional: Postgres (or unset DATABASE_URL for memory only)
npm run dev                   # http://localhost:3000
npm run simulate -- --users 150 --seconds 5    # load test: creates a room, fake members with open sockets pitch in a burst
npm run simulate -- --rooms 3 --users 50       # cross-room load
npm test
```
Create a room from the home page. Admin page: `/admin` (token = `ADMIN_TOKEN`): every room, with pause, resume, run a round now, and reset (new audience).

## Real agents
Set `ANTHROPIC_API_KEY` (or `OPENROUTER_API_KEY` for local dev) and `FAKE_LLM=0`.
`AGENT_COUNT` sets agents per new room (cost hedge, e.g. 100; the stakeholder mix scales down).
`MAX_ACTIVE_ROOMS` caps rooms running rounds at once (others queue) and `MAX_ROOMS` caps rooms kept.
Check `/admin` → each room's `lastRound` (latency, failed sessions, tokens) and `requestsToday`.
Creating a room costs 1 Sonnet request (audience plan) + 1 Haiku request per 50 agents (bios).

## Deploy (Render)
Push the repo, create a Blueprint from `render.yaml`, and set `ANTHROPIC_API_KEY` in the dashboard.
`ADMIN_TOKEN` is generated; read it in the service's Environment tab.
