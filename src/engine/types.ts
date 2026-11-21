export type AuthorType = "agent" | "member";
export type Tier = "power" | "crowd";
export type AgentType = "customer" | "investor" | "industry_lead" | "regulator" | "media";
export const POWER_TYPES = ["investor", "industry_lead", "regulator", "media"] as const satisfies readonly AgentType[];
export type PowerType = (typeof POWER_TYPES)[number];
export const AGENT_TYPES: AgentType[] = ["customer", ...POWER_TYPES];

export type EngagementType = "like" | "repost" | "reply" | "follow" | "unfollow";
/** Private signals on a pitch. What they mean and weigh depends on the agent's segment (rules.signals). */
export type SignalKind = "intent" | "objection";
export type EventType = EngagementType | SignalKind;

export interface Persona {
  /** Market id (markets.ts): the macro attributes this agent shares with the room. */
  market: string;
  name: string;
  age: number;
  region: string;
  tier: Tier;
  /** The segment: customer, investor, industry_lead, regulator or media. */
  type: AgentType;
  /** "Ops manager at an 80-person freight firm", "Seed-stage generalist angel" */
  role: string;
  /** Finer persona label ("Tradies", "Seed angels"). Shapes the persona only; not shown in feedback. */
  group: string;
  /** 2-3 pain points, investment thesis, mandate or beat. */
  priorities: string[];
  adoption: number; // 0-1, how early they try new things
  priceSensitivity: number; // 0-1, how much price matters
  scepticism: number; // 0-1, how hard to impress
  activity: number; // 0-1, how much they engage
  openness: number; // 0-1, how far a pitch can move their interest
  bio: string;
}

export interface Agent {
  id: string;
  handle: string;
  persona: Persona;
  followingIds: string[];
  followerIds: string[];
}

export interface Member {
  id: string;
  nickname: string;
  handle: string;
  followerIds: string[];
  joinedAt: number;
}

export type Counts = Record<EventType, number> & { impressions: number };

/** One segment's response to a pitch (unique agents). */
export interface SegmentRow {
  segment: AgentType;
  seen: number;
  /** Used like, repost, reply or follow. */
  reacted: number;
  intent: number;
  objection: number;
}

/** Feedback numbers, computed in code from a pitch's events and seenBy (scorecard.ts). */
export interface Scorecard {
  views: number;
  reach: number;
  /** (like + repost + reply + follow + unfollow) / views, same as the dashboard's reactions. */
  reactionRate: number;
  /** One row per segment, in AGENT_TYPES order. */
  segments: SegmentRow[];
}

export interface Feedback {
  verdict: string;
  landedWith: string[];
  objections: { theme: string; quote: string }[];
  improvements: string[];
  rewrite: string;
  nextStep: string;
  scorecard: Scorecard;
}

export interface Post {
  id: string;
  authorType: AuthorType;
  authorId: string;
  text: string;
  createdAt: number;
  createdRound: number;
  /** Rounds this post has been in the candidate pool. Final at rules.roundsToFinal. */
  roundsSeen: number;
  /** Unique agents who had it in their feed. Pitches (member posts) only. */
  seenBy: string[];
  counts: Counts;
  points: number;
  finalized: boolean;
  feedback: Feedback | null;
  feedbackStatus: "none" | "pending" | "done" | "error";
}

export interface SimEvent {
  id: number;
  round: number;
  agentId: string;
  type: EventType;
  postId: string;
  /** Reply text or signal reason. */
  text: string | null;
  createdAt: number;
}

export interface RoomState {
  /** Market id. */
  id: string;
  round: number;
  /** Admin pause. When true the engine never runs. */
  paused: boolean;
  running: boolean;
  lastRoundMs: number;
  requestDay: string;
  requestCount: number;
}

export interface FeedItem {
  post: Post;
  /** Followed agent who reposted it, if that is why it is in the feed. */
  viaId: string | null;
}

/** What one agent did in one session (parsed from tool calls). */
export interface SessionResult {
  agentId: string;
  likes: string[];
  reposts: string[];
  replies: { postId: string; text: string }[];
  follows: string[];
  unfollows: string[];
  signals: { postId: string; kind: SignalKind; reason: string }[];
  post: string | null;
}
