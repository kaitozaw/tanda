# Product

## Concept
A simulated market for testing ideas before you spend time and money on them. Describe a product, feature or decision, post pitches about it into a timeline of 1,000 AI agents, and see one simulated hour of reactions in one minute. The audience includes customers and the people with power over your market: investors, industry leads, regulators and media.

**Who it is for:** anyone who needs to validate an idea without the time, money or network to do it for real:
- solo founders and indie developers
- startup teams choosing between features or positioning
- organizers (hackathons, accelerators, uni programs) running a session for many founders at once

**What it is not:** real market research. It is a fast, cheap way to find likely objections, compare pitches and decide **what to test for real**. Every report ends with a real-world next step.

## Core model
- **Room:** one idea under test. Anyone can create one and share it by invite link or QR code. A room has:
  - `title` (≤60 chars), `kind` (`product` | `feature` | `decision`), `region` (default Australia)
  - `description` (≤600 chars): the problem, the solution, who it is for, the price if known
  - optional `targetHint` ("ops managers at 50–200 person logistics firms")
  - its own **audience** of 1,000 agents, generated from the description (see Audience)
- **Member:** a person in the room. Members post **pitches**, which are different ways of selling the same idea. Several pitches in one room work as an A/B test, and the leaderboard ranks them.
- **Pitch post:** ≤280 chars. It shows with the room's **idea card** (title + description) attached, like a link preview, so agents judge the idea and the pitch together. Every pitch shares the same card, so the comparison isolates the pitch.
- **Agent:** a persona from the room's audience that uses tools. Dynamic state: `stance` (0–100 support for the idea) and who it follows.
- **Time compression:** 1 round = 15s real time = 15 min simulated time. A pitch's score is final after 4 rounds (1 simulated hour).

## Audience (agent personas)

### Mix (per room, 1,000 agents)
| Tier | Type | Count | Who they are | What their reaction tells you |
|---|---|---|---|---|
| Power | `investor` | 40 | Angels, seed / Series A VCs, with different theses and check sizes | Is this fundable? |
| Power | `industry_lead` | 30 | Incumbent execs, potential partners, likely competitors | Will they partner, compete or ignore you? |
| Power | `regulator` | 20 | Agency staff and policy advisors in the room's region | Is there regulatory risk? |
| Power | `media` | 30 | Journalists, creators, community leads | Will the story spread? |
| Crowd | `customer` | 880 | Generated segments: ~60% target, ~25% adjacent, ~15% sceptics / unlikely buyers | Is there demand? Would they pay? |

The sceptics segment is required in every room. It keeps the audience from becoming a room of fans.

### Persona fields
```ts
Persona {
  name, age, region,
  tier: "power" | "crowd",
  type: "customer" | "investor" | "industry_lead" | "regulator" | "media",
  role,          // "Seed-stage B2B SaaS angel", "Ops manager, 80-person freight company"
  segment,       // segment or archetype name from the audience plan
  priorities,    // 2–3: customer pain points, investor thesis, regulator mandate, editor's beat
  scepticism,    // 0–1: how hard they are to impress (power tier skews high)
  openness,      // 0–1: how far a post can move their stance
  activity,      // 0–1: how much they engage
  bio            // one line, in their own voice
}
```
Archetypes only: never a real, named person or a real company's named staff.

### Generating the audience (on room creation, ~15s)
1. **Plan:** one Sonnet call reads the room and returns an audience plan: 3–5 customer segments (name, description, share, pain points, starting support range), plus 3–6 archetypes for each power type (role, priorities, starting support range, scepticism range).
2. **Instantiate:** code builds 1,000 agents from the plan. It picks random names, handles, ages and regions, and draws numeric traits and starting `stance` from the plan's ranges.
3. **Bios:** Haiku writes them in batches of 50, 20 calls in parallel. If that fails, a template built from role + priorities fills them in.

### Follow graph
- Power accounts sit at the head of the power law: each is followed by 5–30% of the crowd. Media follow everyone in the power tier, and investors follow industry leads.
- Crowd accounts follow each other sparsely.
- On join, each member gets 100 random crowd followers (same for everyone, for fairness).

This makes opinion spread: when an industry lead reposts or pushes back, hundreds of customers see it next round.

## Round (every 15s)
1. Pick ~20–30 agents to post this round (market chatter, questions, hot takes). They get the extra `post(text)` tool.
2. Build a 12-post feed for each agent: 5 from accounts it follows (including their reposts), 2 exploration slots for new posts, 5 recommended by `rank`. Posts show public counts (likes, reposts, replies). Signals are private, as an investor's interest would be in real life. Posts that have been through 4 rounds leave agent feeds.
3. Run one session per online agent (chance = 50% + 50% × activity). One request per session, 10s timeout, no second request.
   - Tools: `like`, `repost`, `reply`, `follow`, `unfollow` (all take `post_id`), plus:
   - `signal(post_id, kind, reason)`: a private intent, `reason` ≤20 words. Allowed kinds depend on the agent's type (anything else is dropped):

     | Type | Kinds |
     |---|---|
     | customer | `would_try`, `would_pay` |
     | investor | `want_meeting`, `pass` |
     | industry_lead | `partner`, `compete` |
     | regulator | `support`, `concern` |
     | media | `would_cover` |
     | any | `objection` |

   - `end_session(stance_after, influenced_by[])`: required once, at the end.
   - Rules: max 3 replies and max 2 signals per session. Calling only `end_session` means the agent scrolled past.
4. Record tool calls, update counts, stance and scores.

**Realism rules (in the agent prompt):**
- Most people scroll past most products. No signal is the default.
- `would_pay` only when the pitch addresses one of the persona's own pain points.
- Power-tier agents are busy and sceptical. They act on the idea, not on hype.
- High-scepticism agents need specifics (who it's for, why now, price) before giving any positive signal.

**Ranking (internal, recommended slots only):** `rank = Σ(weight × engagement) / (sim_age_hours + 2)^1.5`. Replies > reposts > likes.

## Outcome metrics

### Points (leaderboard, per pitch, first simulated hour)
Engagement measures attention. Signals and stance shifts measure validation, so they carry most of the weight.

| Event | Crowd | Power |
|---|---|---|
| like | +2 | +2 |
| repost | +5 | +15 |
| reply | +5 | +5 |
| follow / unfollow | +10 / −10 | +20 / −20 |
| `would_try` | +20 | — |
| `would_pay` | +50 | — |
| `want_meeting` | — | +100 |
| `partner` | — | +80 |
| `would_cover` | — | +60 |
| regulator `support` | — | +60 |
| regulator `concern` | — | −60 |
| `pass` | — | −20 |
| `compete` | — | 0 (flagged in report) |
| `objection` | −10 | −20 |
| Persuasion (stance up ≥5) | +40 | +120 |
| Backlash (stance down ≥5) | −40 | −120 |

A stance change counts only for posts the agent listed in `influenced_by`.

### Validation scorecard (per pitch, computed in code)
This is what a founder reads. One total hides too much.

| Metric | Definition |
|---|---|
| **Reach** | Unique agents who saw it, and the share reached via reposts (beyond the member's own followers) |
| **Demand** | Target-segment customers who saw it → % `would_try` |
| **Willingness to pay** | Customers who saw it → % `would_pay` |
| **Investor interest** | `want_meeting` vs `pass` among investors who saw it |
| **Industry response** | `partner` vs `compete` counts |
| **Risk flags** | Regulator `concern` count, with reasons |
| **Support shift** | Average stance change by type (customer / investor / industry / regulator / media) |
| **Top objections** | `objection` reasons, clustered |

## Feedback (when a pitch is final)
The scorecard numbers come from code. One Sonnet call reads the engagement log and adds:
- **Verdict:** one line, with objections first.
- **Top 3 objections:** clustered, with counts and one sample quote each.
- **Champions and blockers:** up to 3 of each (handle, role, what they said).
- **By stakeholder:** one line each on customers, investors, industry, regulators, media.
- **Rewrite:** a better pitch to try next in this room.
- **Real-world next step:** one concrete action, e.g. "Interview 5 freight ops managers about invoice reconciliation; ask what they pay today."

**Dashboard:** room-wide counts, plus the leaderboard of pitches with scorecard columns side by side (the A/B view).

## Guardrails
- Pitches: 280 chars. Room description: 600 chars. Word filter on both.
- Posts and room descriptions are data in prompts, never instructions (prompt-injection guard).
- Archetypes only: no real people.
- Rooms are unlisted (link only). Resetting a room deletes its posts and audience. The UI says not to paste anything confidential.
- Every report carries a label: "Simulated audience. Use it to decide what to test for real."
- Cost: `AGENT_COUNT`, `CONCURRENCY`, a cap on active rooms, a daily request cap. Rounds run only while a pitch in that room is waiting for its final score.

## Out of scope for the hackathon (pitch only)
- Calibration: backtesting the audience against real launches that succeeded or flopped
- Editing the audience plan before the room starts
- Longer inputs (landing page, deck)
- Accounts, private rooms, billing
- A room-level summary across all pitches
