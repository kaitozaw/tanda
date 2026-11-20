import { hasLlmKey, usingOpenRouter } from "./llm";

const num = (v: string | undefined, d: number) => (v && !Number.isNaN(Number(v)) ? Number(v) : d);

export const config = {
  agentCount: num(process.env.AGENT_COUNT, 1000),
  concurrency: num(process.env.CONCURRENCY, 1000),
  roundMs: num(process.env.ROUND_MS, 15000),
  sessionTimeoutMs: num(process.env.SESSION_TIMEOUT_MS, 10000),
  // Feedback for posts that finalize together must be ready within the 1-minute reveal.
  feedbackConcurrency: num(process.env.FEEDBACK_CONCURRENCY, 30),
  // At most one "refetch" push to the room per this many ms (see broadcaster).
  refreshMs: num(process.env.REFRESH_MS, 1000),
  dailyRequestCap: num(process.env.DAILY_REQUEST_CAP, 200000),
  fakeLlm: process.env.FAKE_LLM === "1" || !hasLlmKey(),
  adminToken: process.env.ADMIN_TOKEN ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  // OpenRouter uses its own model ids; override with AGENT_MODEL / FEEDBACK_MODEL if they differ.
  agentModel: process.env.AGENT_MODEL ?? (usingOpenRouter() ? "anthropic/claude-haiku-5.5" : "claude-haiku-5-5"),
  feedbackModel: process.env.FEEDBACK_MODEL ?? (usingOpenRouter() ? "anthropic/claude-sonnet-5.5" : "claude-sonnet-5-5"),
};

/** Product rules from plan/PRODUCT.md. */
export const rules = {
  roomId: "au-u16-ban",
  topic: "Australia's under-16 social media ban",
  roundsToFinal: 4,
  simMinutesPerRound: 15,
  postersPerRound: 25, // per 1,000 agents
  memberStartFollowers: 100, // per 1,000 agents (10%)
  feed: { follows: 5, recommended: 5, exploration: 2 },
  maxRepliesPerSession: 3,
  stanceThreshold: 5,
  maxPostChars: 280,
  postCooldownMs: 5000, // per member, so one person cannot flood the room
  points: {
    like: 5,
    repost: 10,
    reply: 15,
    follow: 20,
    unfollow: -20,
    persuasion: 160,
    backlash: -80,
    neutralShift: 20,
  },
  rankWeights: { like: 1, repost: 3, reply: 6 },
};
