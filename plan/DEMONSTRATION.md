# Demonstration

## Pitch line
"Test your idea on 1,000 AI stakeholders before you spend a dollar on it. Customers, investors, industry and regulators react in one minute."

## Setup
- The demo uses one room, created **live on stage** from the home page:
  - Title: **"Australia's under-16 social media ban"**
  - Kind: `decision`. Region: Australia.
  - Description: what the ban does, who it affects and how it is enforced (≤600 chars, written and rehearsed beforehand).
- The audience (~100 people) plays policy advisers. Each writes a pitch to win support for the ban from the people it affects and the people with power over it. Everyone is in the same room, so the leaderboard works as a 100-way A/B test of messaging.
- The generated audience should include parents, teens, teachers and sceptics as the crowd, plus safety-tech investors, platform and telco execs, eSafety and education officials, and tech and parenting journalists as power holders. The power holders are what make this demo different from a poll.
- Big screen and phones use the same responsive app. The big screen moves from the Timeline (while the audience builds) to the Dashboard. Phones are used to post and get notifications.

### Before the event
- Create a **backup room** with the same inputs and check its audience plan (segments make sense, sceptics present, every power type filled). Keep its QR code ready.
- Rehearse with `npm run simulate`, check the rate limit, and set `MAX_ACTIVE_ROOMS` / `AGENT_COUNT` (see [PERFORMANCE.md](PERFORMANCE.md)).
- Run a **sanity check**: post a deliberately weak pitch (vague, preachy) in the backup room. It should score low and collect objections. If it does well, tighten the realism rules in the agent prompt before the demo.

## Room tabs
| Tab | Content |
|---|---|
| **Timeline** (default) | Idea card pinned at the top, live feed of agent posts and pitches, the pitch composer. While the room is generating: audience build progress. |
| **Dashboard** | Room counts, the **Audience** panel (agents per stakeholder type and segment), and the pitch leaderboard with scorecard columns. Tap a row to see the full pitch, scorecard and breakdown. |
| **My Pitches** | Each of my pitches with score, scorecard, activity log (including signals and their reasons) and AI feedback once final. Tab badge shows unread reactions. |

Notifications: a toast appears on any tab when a round adds a reaction or signal to one of my pitches ("@seed_vc_priya wants a meeting", "@esafety_officer_dan raised a concern"). Signals are private: never in public counts, but the pitch's author sees them.

## Flow (3 min)
| Time | Phase | What happens |
|---|---|---|
| 0:00–0:20 | **Build** | Create the room on stage. The big screen shows the audience appearing: segments and power holders from the plan. Show the QR code; people join while it builds. If generation fails or stalls past 30s, switch to the backup room's QR. |
| 0:20–1:00 | **Pitch** | Each person enters a nickname and posts a pitch (max 280 chars, more than one allowed). Agents are already posting market chatter. |
| 1:00–2:00 | **Simulate** | Rounds run until every pitch has been through 4 rounds (= 1 simulated hour). Leaderboard updates live; phones get notifications. |
| 2:00–3:00 | **Reveal** | Scores are final. Big screen: open the #1 pitch, then walk through its scorecard by stakeholder (e.g. strong with parents, industry pushing back, regulators supportive), top objections, and the real-world next step. Phones: everyone opens My Pitches for their own feedback. |

**Close:** "That was a policy. Now try your own idea." Room creation stays open. `MAX_ACTIVE_ROOMS` queues the rest, and the UI shows "queued" for rooms waiting their turn.
