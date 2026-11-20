# Product

## Concept
A pre-publish testing tool for social media marketers. You post into a simulated timeline with 1,000 AI agents and see one hour of real engagement in one minute, plus feedback on how to improve the post.

## Core model
- **Room:** a team workspace with a topic, a target audience (its agents, who care about the topic) and members. Members join by invite link or QR code and share the timeline, the dashboard and each other's posts.
- **Agent:** a persona that uses tools.
  - Static: age, region, role, political leaning, interests, activity level, openness.
  - Dynamic: `stance` (0–100 on the room's topic) and who it follows.
  - Follow graph is power-law (a few influencers, many small accounts). On join, each member gets random agent followers equal to 10% of the agents, i.e. 100 of 1,000 (same for everyone, for fairness). This gives every post a starting audience and makes unfollow possible.
- **Time compression:** 1 round = 15s real time = 15 min simulated time. A post's score is final after it has been through 4 rounds (= 1 simulated hour), so every post gets the same number of rounds whenever it was posted.

## Round (every 15s)
1. Pick ~20–30 agents to post this round. They get an extra `post(text)` tool in step 3.
2. Build a feed of 12 posts for each agent:
   - 5 from accounts it follows, including their reposts.
   - 2 exploration slots for new posts, so new posts always get some reach.
   - 5 recommended posts from accounts it does not follow, picked by `rank` (also fills any empty slots above).
   - Each post shows its like, repost and reply counts (social proof).
   - Posts that have been through 4 rounds (human or agent) leave agent feeds. Humans can still see them.
3. Run a session for each agent that is online this round (chance = 50% + 50% × activity, since not everyone opens the app every 15 min). Sessions run in parallel. One request per session, with a 10s timeout; late sessions count as no action.
   - Tools: `like(post_id)`, `repost(post_id)`, `reply(post_id, text)`, `follow(post_id)`, `unfollow(post_id)` (follow / unfollow the author of that post, so the points go to that post), `end_session(stance_after, influenced_by[])`.
   - The agent calls several tools in one response (parallel tool use). No tool results are sent back, so there is no second request.
   - Rules: `end_session` is required once at the end (if missing, stance is unchanged). Max 3 replies per session. Calling only `end_session` means the agent scrolled past.
4. Record tool calls, update counts and scores.

**Ranking (internal, only for recommended slots):** `rank = Σ(weight × engagement) / (sim_age_hours + 2)^1.5`. Replies weigh more than reposts, and reposts more than likes. Not the same as the points score below.

## Scoring (human posts, first simulated hour)
| Event | Points |
|---|---|
| like | +5 |
| repost | +10 |
| reply | +15 |
| follow | +20 |
| unfollow | −20 |
| Persuasion (stance moved ≥5 toward the poster's side) | +160 |
| Backlash (stance moved ≥5 away from the poster's side) | −80 |
| Shift when the poster chose Neutral | +20 |

A stance change only counts for posts the agent listed in `influenced_by`.

## Feedback
When a post's score is final, one LLM call reads the engagement log and returns:
- views, reaction rate, reactions by segment
- concrete improvements and a rewrite

## Guardrails
- 280 chars; word filter.
- Posts are treated as data in prompts, not as instructions (prompt-injection guard).
- Agent count and concurrency are config values (`AGENT_COUNT`, `CONCURRENCY`), so they can be lowered if we hit the rate limit.
- Rounds run only while a human post is waiting for its final score; otherwise the timeline is idle. Daily request cap.

## Out of scope (pitch only)
A/B comparison of post variants, custom rooms and audiences.
