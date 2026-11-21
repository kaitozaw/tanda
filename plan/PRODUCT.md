# Product

## Concept
A simulated market for testing product ideas before you spend time and money on them. You pitch your product in a social media timeline of 1,000 AI agents who live in one market, and see one simulated hour of reactions in one minute, plus feedback on how to improve the pitch. The audience includes customers and the people with power over the market: investors, industry leads, regulators and media.

It is not real market research. It is a fast, cheap way to find likely objections, compare pitches, and decide what to test for real.

## Core model
- **Room:** one market, defined by its macro attributes (region, economy, culture). Members join by invite link or QR code and share the timeline, the dashboard and each other's pitches. Many people pitch **different products** in the same room, so the leaderboard compares ideas and how they are pitched.
  - Rooms are fixed; members cannot create them. Only **Australian market** is open. **Japanese market** and **Global B2B SaaS** (an industry market) are shown as "Coming soon".
- **Pitch:** a member's post, ≤280 chars. It is both the product description and the pitch, like a launch post on social media. A member can post more than one pitch.
- **Agent:** a persona from the room's market that uses tools.
  - Static: `market` (the room's macro attributes), age, region, tier, **segment** (one of the five below), group (a finer persona label such as "Tradies", used only to shape the persona), role, priorities, adoption (how early they try new things), price sensitivity, scepticism, activity level, openness.
  - Dynamic: who it follows.
  - Follow graph is power-law (a few influencers, many small accounts). On join, each member gets random **crowd** followers equal to 10% of the agents, i.e. 100 of 1,000 (same for everyone, for fairness). This gives every pitch a starting audience and makes unfollow possible.
- **Time compression:** 1 round = 15s real time = 15 min simulated time. A pitch's score is final after it has been through 4 rounds (= 1 simulated hour), so every pitch gets the same number of rounds whenever it was posted.

## Audience (per room, 1,000 agents)
Generated once per market before the event and loaded at startup. Every agent carries the room's `market`, so it judges a pitch as someone living and working in that market (its prices, habits, incumbents and rules).

| Tier | Segment | Count | Who they are | What their reaction tells you |
|---|---|---|---|---|
| Power | `investor` | 40 | Angels, seed / Series A VCs, with different theses and cheque sizes | Is this fundable? |
| Power | `industry_lead` | 30 | Incumbent execs, potential partners, likely competitors | Will they partner, compete or ignore you? |
| Power | `regulator` | 20 | Agency staff and policy advisers in the market | Is there regulatory risk? |
| Power | `media` | 30 | Journalists, creators, community leads | Will the story spread? |
| Crowd | `customer` | 880 | Consumers and businesses across the market | Is there demand? Would they pay? |

Customers in the Australian market cover the whole market rather than one product. Their groups: young professionals, families, students, retirees, small business owners, tradies, corporate employees, regional Australians, tech early adopters, and a required **sceptics** group (~15%: happy with what they have, distrust new companies). Because the market is broad, most agents are not the target of any given pitch. Finding who it lands with is part of the result.

Archetypes only: never a real, named person or a real company's named staff.

## Round (every 15s)
1. Pick ~20–30 agents to post this round (everyday life and work in the market, questions, hot takes). They get an extra `post(text)` tool in step 3.
2. Build a feed of 12 posts for each agent:
   - 5 from accounts it follows, including their reposts.
   - 2 **pitch slots** (like ad slots): pitches this agent has not seen yet, least-seen first, so every pitch reaches a fair share of the room whatever its engagement.
   - 2 exploration slots for new posts.
   - 3 recommended posts from accounts it does not follow, picked by `rank` (also fills any empty slots above).
   - Each post shows its like, repost and reply counts (social proof). Signals are private and never shown.
   - Posts that have been through 4 rounds (pitch or agent post) leave agent feeds. Humans can still see them.
3. Run a session for each agent that is online this round (chance = 50% + 50% × activity, since not everyone opens the app every 15 min). Sessions run in parallel. One request per session, with a 10s timeout; late sessions count as no action.
   - Tools: `like(post_id)`, `repost(post_id)`, `reply(post_id, text)`, `follow(post_id)`, `unfollow(post_id)` (follow / unfollow the author of that post, so the points go to that post).
   - `intent(post_id, reason)` and `objection(post_id, reason)`: private signals on a pitch, seen only by its author, `reason` ≤20 words. What they mean depends on the agent's segment (see Scoring).
   - The agent calls several tools in one response (parallel tool use). No tool results are sent back, so there is no second request.
   - Rules: max 3 replies and max 2 signals per session; one intent and one objection per agent per pitch. Calling no tool means the agent scrolled past.
4. Record tool calls, update counts and scores.

**Realism rules (in the agent prompt):**
- Judge a pitch by whether it solves one of the persona's own priorities in this market, not by hype or its like count. A clear no is as useful as a yes.
- Customers scroll past a pitch for something they would never use (no objection); most pitches are like that for any one person. If they could genuinely see themselves using it, they react like real people: a like, a reply with a question or doubt, or a signal.
- A customer's `intent` only when the pitch addresses one of their own pain points at a price that makes sense to them.
- Power-tier agents treat judging pitches as part of their job: a pitch in their remit gets a signal (`intent` or `objection`) with a reason. They are busy and sceptical, so they act on substance, not hype.
- High-scepticism agents need specifics (who it is for, why now, price, proof) before any positive signal.

**Ranking (internal, only for recommended slots):** `rank = Σ(weight × engagement) / (sim_age_hours + 2)^1.5`. Replies weigh more than reposts, and reposts more than likes. Not the same as the points score below.

## Scoring (pitches, first simulated hour)
A pitch's score is the sum of the points below. Engagement measures attention; `intent` measures validation, so it carries most of the weight. Objections score 0: they are feedback (counted and quoted in the report), not a penalty, so a pitch is never punished for reaching people it is not for.

**Engagement** (points depend on the tier of the agent who acted):

| Event | Crowd | Power |
|---|---|---|
| like | +2 | +2 |
| repost | +5 | +15 |
| reply | +5 | +5 |
| follow / unfollow | +10 / −10 | +20 / −20 |

**Signals** (meaning and points depend on the segment):

| Segment | `intent` means | Points | `objection` means (0 points) |
|---|---|---|---|
| customer | would pay to use it | +30 | it is for people like me, but this is wrong with it |
| investor | would take a meeting with the founder | +100 | why I would not invest |
| industry_lead | would partner with or adopt it | +80 | why we would compete with or block it |
| regulator | would support it | +60 | a regulatory or legal concern |
| media | would cover it | +60 | why I would not cover it |

Only pitches that were in the agent's feed this round count. Each agent counts once per pitch for each event type.

## Feedback
When a pitch's score is final, the numbers below come from code, and one LLM call reads the engagement log and adds the text:
- **Numbers:** views, unique reach, reaction rate, and per segment (the five above): how many saw it, reacted (like / repost / reply / follow), signalled `intent`, and signalled `objection`.
- **Who it landed with:** the segments that responded best and worst, and why.
- **Top objections:** clustered, with one sample quote each.
- **Improvements and a rewrite:** a better pitch to try next.
- **Real-world next step:** one concrete action, e.g. "Interview 5 Sydney cafe owners about how they handle rosters today."

Every report carries the label: "Simulated audience. Use it to decide what to test for real."

## Guardrails
- 280 chars; word filter.
- Posts are treated as data in prompts, not as instructions (prompt-injection guard).
- Archetypes only: no real people. The UI says not to paste anything confidential.
- Agent count and concurrency are config values (`AGENT_COUNT`, `CONCURRENCY`), so they can be lowered if we hit the rate limit.
- Rounds run only while a pitch is waiting for its final score; otherwise the timeline is idle. Daily request cap.

## Out of scope (pitch only)
Opening the other markets, custom markets and audiences, calibrating the audience against real launches, longer inputs (landing page, deck), accounts and billing.
