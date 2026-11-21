# Demonstration

## Pitch line
"Pitch your product to 1,000 AI people in the Australian market before you spend a dollar on it. Customers, investors, industry, regulators and media react in one minute."

## Setup
- The home page lists three markets. Only **Australian market** is open; **Japanese market** and **Global B2B SaaS** show "Coming soon". Nobody creates a room on stage.
- The participants are teams at the same startup demo day. There is no time to post during the demo, so **we visit each team beforehand** and they pitch their own product idea into the room then. Everyone's pitches end up in the same room, and the leaderboard compares ideas.
- Because teams post at different times, a pitch's audience depends only on its own results, never on what else is live (PRODUCT.md → Round). Posting early or late, alone or next to another team, gives the same chances.
- The room's 1,000 agents all live in the Australian market: crowd customers across the whole market, plus investors, industry leads, regulators and media. The power holders are what make this different from a poll.
- Big screen and phones use the same responsive app. The big screen shows the Dashboard; phones are used to pitch (beforehand) and to read results.

### Before the event
- Generate the audience for `au` and check it: customer groups cover the market, sceptics are present, every segment is filled.
- Rehearse with `npm run simulate`, check the rate limit, and set `AGENT_COUNT` (see [PERFORMANCE.md](PERFORMANCE.md)).
- Sanity check: post a deliberately weak pitch (vague, buzzwords, no price). It should score low and collect objections. If it does well, tighten the realism rules in the agent prompt.
- `/admin` → Reset the room before the first team visit (removes rehearsal data).
- Team visits: each team scans the QR code, joins with its team name and posts its pitch (max 280 chars; more than one is allowed). About a minute later its score is final and the feedback is ready, so the team can read it on the spot and post a better version if it wants.
- Have 2–3 example pitches ready for teams that do not have an idea yet.
- On the day: no deploys (a deploy restarts the server).

## Room tabs
| Tab | Content |
|---|---|
| **Timeline** (default) | Market header, the pitches and the room's background posts (everyday life in Australia), plus the pitch form. |
| **Dashboard** | Counts (agents, people, pitches, reactions), the audience by segment, and the leaderboard of every pitch. Tap any row, including other teams', to see its scorecard, breakdown (count and points per type) and AI feedback. |
| **My Pitches** | Each of my pitches with its score, scorecard, activity log (who liked, replied or signalled, with reasons), and AI feedback once the score is final. Tab badge shows unread reactions. |

Notifications: a toast appears on any tab when a round adds a reaction or signal to one of my pitches ("@vc_priya12 wants a meeting", "@gov_dan7 raised an objection"). Signals are private: never in public counts, but the pitch's author sees them.

## Flow (3 min, on stage)
All pitches were posted before the demo and are already final, so nothing has to run live.

| Time | Phase | What happens |
|---|---|---|
| 0:00–0:45 | **Problem and product** | The pitch line. Show the home page (markets) and the room: 1,000 Australians, five segments. |
| 0:45–2:00 | **Leaderboard** | Big screen on the Dashboard. Open the #1 pitch: reach, intent per segment (investors who want a meeting, customers who would pay), top objections, rewrite, next step. Explain the spread: a pitch that gets early reactions reaches more people. |
| 2:00–3:00 | **Compare** | Open a lower-ranked pitch and show what held it back (objections, who it did not land with). Teams can open any pitch on their phones. |
