# Demonstration

## Pitch line
"Pitch your product to 1,000 AI people in the Australian market before you spend a dollar on it. Customers, investors, industry, regulators and media react in one minute."

## Setup
- The home page lists three markets. Only **Australian market** is open; **Japanese market** and **Global B2B SaaS** show "Coming soon". Nobody creates a room on stage.
- The audience (~100 people) plays founders at the same startup demo day. Each pitches their own product idea (real or made up) into the same room, so everyone sees each other's pitches and the leaderboard compares ideas.
- The room's 1,000 agents all live in the Australian market: crowd customers across the whole market, plus investors, industry leads, regulators and media. The power holders are what make this different from a poll.
- Big screen and phones use the same responsive app. The big screen stays on the Dashboard tab; phones are used to pitch and to get notifications.

### Before the event
- Generate the audience for `au` and check it: customer groups cover the market, sceptics are present, every segment is filled.
- Rehearse with `npm run simulate`, check the rate limit, and set `AGENT_COUNT` (see [PERFORMANCE.md](PERFORMANCE.md)).
- Sanity check: post a deliberately weak pitch (vague, buzzwords, no price). It should score low and collect objections. If it does well, tighten the realism rules in the agent prompt.
- Prepare 2–3 example pitches on a slide for people who do not have an idea ready.

## Room tabs
| Tab | Content |
|---|---|
| **Timeline** (default) | Market header, live feed of agent posts and pitches, plus the pitch form. |
| **Dashboard** | Counts (agents, people, pitches, reactions), the audience by type, and the leaderboard of pitches. Tap a row to see the full text, scorecard and engagement breakdown (count and points per type). |
| **My Pitches** | Each of my pitches with its score, scorecard, activity log (who liked, replied or signalled, with reasons), and AI feedback once the score is final. Tab badge shows unread reactions. |

Notifications: a toast appears on any tab when a round adds a reaction or signal to one of my pitches ("@vc_priya12 wants a meeting", "@gov_dan7 raised an objection"). Signals are private: never in public counts, but the pitch's author sees them.

## Flow (3 min)
| Time | Phase | What happens |
|---|---|---|
| 0:00–1:00 | **Pitch** | Show the QR code (can start during the talk). Each person enters a nickname and pitches their product (max 280 chars; more than one pitch is allowed). Agents already post about everyday life in Australia every 15s. |
| 1:00–2:00 | **Simulate** | Rounds keep running until every pitch has been through 4 rounds (= 1 simulated hour). Leaderboard updates live; phones get notifications. |
| 2:00–3:00 | **Reveal** | Scores are final. Big screen: open the #1 pitch and walk through its scorecard (intent and objections per segment, who it landed with, top objections, next step). Phones: everyone opens My Pitches to see their own feedback. |
