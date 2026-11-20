# Pre-demo checklist

- [ ] Render: `standard` plan, 1 instance. Deploy log says `model claude-haiku-5-5`, not `FAKE_LLM`.
- [ ] Claude limits: Haiku ~3,000 req/min, Sonnet ~30 parallel.
- [ ] Rehearsal: `npm run simulate -- --users 150 --seconds 5 --url <prod>` → `failures: 0`, and `/admin` `lastRound.rateLimited` / `timedOut` ≈ 0.
- [ ] Phones on venue Wi-Fi: timeline updates live.
- [ ] On the day: no deploys. `requestCount` under the cap (resets at UTC midnight). `/admin` → Reset just before the demo.
