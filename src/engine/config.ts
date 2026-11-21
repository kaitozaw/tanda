import { hasLlmKey, usingOpenRouter } from "./llm";
import type { AgentType, EventType, PowerType, SignalKind, Tier } from "./types";

const num = (v: string | undefined, d: number) => (v && !Number.isNaN(Number(v)) ? Number(v) : d);

export const config = {
  /** Agents generated per room (max 1000). The PRODUCT.md mix is scaled to this. */
  agentCount: Math.min(1000, num(process.env.AGENT_COUNT, 1000)),
  /** Concurrent Claude requests, shared by every room. */
  concurrency: num(process.env.CONCURRENCY, 1000),
  roundMs: num(process.env.ROUND_MS, 15000),
  sessionTimeoutMs: num(process.env.SESSION_TIMEOUT_MS, 10000),
  // Feedback for pitches that finalize together must be ready within the 1-minute reveal.
  feedbackConcurrency: num(process.env.FEEDBACK_CONCURRENCY, 30),
  // At most one "refetch" push to a room per this many ms (see broadcaster).
  refreshMs: num(process.env.REFRESH_MS, 1000),
  dailyRequestCap: num(process.env.DAILY_REQUEST_CAP, 200000),
  /** Rooms that run rounds at once; others with pending pitches are queued. */
  maxActiveRooms: num(process.env.MAX_ACTIVE_ROOMS, 3),
  /** Rooms kept in total (memory and snapshot size). */
  maxRooms: num(process.env.MAX_ROOMS, 20),
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
  roundsToFinal: 4,
  simMinutesPerRound: 15,
  postersPerRound: 25, // per 1,000 agents
  memberStartFollowers: 100, // per 1,000 agents (10%), crowd only
  feed: { follows: 5, recommended: 5, exploration: 2 },
  maxRepliesPerSession: 3,
  maxSignalsPerSession: 2,
  maxReasonWords: 20,
  stanceThreshold: 5,
  maxPostChars: 280,
  maxTitleChars: 60,
  maxDescriptionChars: 600,
  maxTargetHintChars: 120,
  postCooldownMs: 5000, // per member, so one person cannot flood the room
  /** Agents per type at 1,000 agents. Customers get the rest. */
  mix: { investor: 40, industry_lead: 30, regulator: 20, media: 30 } satisfies Record<PowerType, number>,
  signals: {
    customer: ["would_try", "would_pay", "objection"],
    investor: ["want_meeting", "pass", "objection"],
    industry_lead: ["partner", "compete", "objection"],
    regulator: ["support", "concern", "objection"],
    media: ["would_cover", "objection"],
  } satisfies Record<AgentType, SignalKind[]> as Record<AgentType, SignalKind[]>,
  points: {
    like: both(2),
    repost: { crowd: 5, power: 15 },
    reply: both(5),
    follow: { crowd: 10, power: 20 },
    unfollow: { crowd: -10, power: -20 },
    would_try: { crowd: 20, power: 0 },
    would_pay: { crowd: 50, power: 0 },
    want_meeting: { crowd: 0, power: 100 },
    partner: { crowd: 0, power: 80 },
    would_cover: { crowd: 0, power: 60 },
    support: { crowd: 0, power: 60 },
    concern: { crowd: 0, power: -60 },
    pass: { crowd: 0, power: -20 },
    compete: both(0),
    objection: { crowd: -10, power: -20 },
    persuasion: { crowd: 40, power: 120 },
    backlash: { crowd: -40, power: -120 },
  } satisfies Record<EventType, Pts>,
  rankWeights: { like: 1, repost: 3, reply: 6 },
};
