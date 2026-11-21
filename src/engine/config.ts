import { hasLlmKey, usingOpenRouter } from "./llm";
import { OPEN_MARKET } from "./markets";
import type { Segment, EngagementType, PowerSegment, Tier } from "./types";

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

type Pts = Record<Tier, number>;
const both = (n: number): Pts => ({ crowd: n, power: n });

/** Product rules from plan/PRODUCT.md. */
export const rules = {
  /** The room the engine runs: the open market. */
  roomId: OPEN_MARKET.id,
  roundsToFinal: 4,
  simMinutesPerRound: 15,
  postersPerRound: 25, // per 1,000 agents
  memberStartFollowers: 100, // per 1,000 agents (10%), crowd only
  feed: { follows: 5, pitches: 2, exploration: 2, recommended: 3 }, // 12 slots
  maxRepliesPerSession: 3,
  maxSignalsPerSession: 2,
  maxReasonWords: 20,
  maxPostChars: 280,
  postCooldownMs: 5000, // per member, so one person cannot flood the room
  /** Agents per type at 1,000 agents. Customers get the rest. */
  mix: { investor: 40, industry_lead: 30, regulator: 20, media: 30 } satisfies Record<PowerSegment, number>,
  /** Engagement points by the acting agent's tier. */
  points: {
    like: both(2),
    repost: { crowd: 5, power: 15 },
    reply: both(5),
    follow: { crowd: 10, power: 20 },
    unfollow: { crowd: -10, power: -20 },
  } satisfies Record<EngagementType, Pts>,
  /** Signal meaning (shown to the agent) by segment. Intent scores; objections are feedback only (0 points). */
  signals: {
    customer: {
      intent: { means: "you would pay to use it (only if it solves one of your own pain points at a price that makes sense to you)", points: 30 },
      objection: { means: "it is aimed at people like you, but this is wrong with it" },
    },
    investor: {
      intent: { means: "you would take a meeting with the founder", points: 100 },
      objection: { means: "why you would not invest" },
    },
    industry_lead: {
      intent: { means: "your company would partner with it or adopt it", points: 80 },
      objection: { means: "why your company would compete with it or block it" },
    },
    regulator: {
      intent: { means: "your agency would support it", points: 60 },
      objection: { means: "a regulatory, legal or safety concern" },
    },
    media: {
      intent: { means: "you would write about it or feature it", points: 60 },
      objection: { means: "why you would not cover it" },
    },
  } satisfies Record<Segment, { intent: { means: string; points: number }; objection: { means: string } }>,
  rankWeights: { like: 1, repost: 3, reply: 6 },
};
