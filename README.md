# Capture the Narrative

Test a social media post on 1,000 AI agents and see one simulated hour of engagement in one minute.
Specs: [plan/PRODUCT.md](plan/PRODUCT.md), [plan/DESIGN.md](plan/DESIGN.md), [plan/DEMONSTRATION.md](plan/DEMONSTRATION.md). Before the demo: [plan/PERFORMANCE.md](plan/PERFORMANCE.md).

## Run locally
```bash
npm install
cp .env.example .env          # FAKE_LLM=1 needs no API key
docker compose up -d          # optional: Postgres (or unset DATABASE_URL for memory only)
npm run dev                   # http://localhost:3000
npm run simulate -- --users 150 --seconds 5    # load test: fake members with open sockets post in a burst
npm test
```
Admin page: `/admin` (token = `ADMIN_TOKEN`): status, pause, resume, reset the room.

## Real agents
Set `ANTHROPIC_API_KEY` (or `OPENROUTER_API_KEY` for local dev) and `FAKE_LLM=0`.
`AGENT_COUNT` caps how many agents run each round (cost hedge, e.g. 100). Check `/admin` → `lastRound`
(latency, failed sessions, tokens). Regenerate personas with Haiku bios: `npm run agents:generate`.

## Deploy (Render)
Push the repo, create a Blueprint from `render.yaml`, and set `ANTHROPIC_API_KEY` in the dashboard.
`ADMIN_TOKEN` is generated; read it in the service's Environment tab.
