export type AuthorType = "agent" | "member";
export type RoomKind = "product" | "feature" | "decision";
export type Tier = "power" | "crowd";
export type AgentType = "customer" | "investor" | "industry_lead" | "regulator" | "media";
export const POWER_TYPES = ["investor", "industry_lead", "regulator", "media"] as const satisfies readonly AgentType[];
export type PowerType = (typeof POWER_TYPES)[number];
export const AGENT_TYPES: AgentType[] = ["customer", ...POWER_TYPES];

export type EngagementType = "like" | "repost" | "reply" | "follow" | "unfollow";
export const SIGNAL_KINDS = [
  "would_try", "would_pay", "want_meeting", "pass", "partner", "compete", "support", "concern", "would_cover", "objection",
] as const;
export type SignalKind = (typeof SIGNAL_KINDS)[number];
export type ShiftType = "persuasion" | "backlash";
export type EventType = EngagementType | SignalKind | ShiftType;

export interface Persona {
  name: string;
  age: number;
  region: string;
  tier: Tier;
  type: AgentType;
  /** "Seed-stage B2B SaaS angel", "Ops manager, 80-person freight company" */
  role: string;
  /** Customer segment or power archetype name from the audience plan. */
  segment: string;
  /** Pain points, investment thesis, mandate or beat. */
  priorities: string[];
  scepticism: number; // 0-1, how hard to impress
  openness: number; // 0-1, how far a post can move their stance
  activity: number; // 0-1, how much they engage
  bio: string;
}

export interface Agent {
  id: string;
  handle: string;
  persona: Persona;
  /** 0-100 support for the room's idea. */
  stance: number;
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

export type Counts = Record<EventType, number> & { impressions: number; impressionsViaRepost: number };

// ---------- audience plan (Sonnet output, see audience.ts) ----------

export interface Range {
  min: number;
  max: number;
}

export interface Segment {
  name: string;
  description: string;
  kind: "target" | "adjacent" | "sceptic";
  /** Percent of the crowd. */
  share: number;
  roles: string[];
  painPoints: string[];
  ageRange: Range;
  stanceRange: Range;
}

export interface Archetype {
  name: string;
  role: string;
  priorities: string[];
  stanceRange: Range;
  scepticismRange: Range;
}

export interface AudiencePlan {
  locations: string[];
  segments: Segment[];
  archetypes: Record<PowerType, Archetype[]>;
}

// ---------- scorecard + feedback ----------

export interface StakeholderRow {
  type: AgentType;
  seen: number;
  positive: number;
  negative: number;
  /** Mean stance change across agents of this type who saw the pitch. */
  avgShift: number;
}

export interface Scorecard {
  reach: { unique: number; impressions: number; viaRepostPct: number };
  demand: { seen: number; yes: number; pct: number };
  pay: { seen: number; yes: number; pct: number };
  investors: { seen: number; meeting: number; pass: number };
  industry: { partner: number; compete: number };
  risk: { concerns: number; reasons: string[] };
  stakeholders: StakeholderRow[];
  objections: { handle: string; type: AgentType; reason: string }[];
}

export interface Person {
  handle: string;
  role: string;
  said: string;
}

export interface Feedback {
  verdict: string;
  objections: { theme: string; count: number; quote: string }[];
  champions: Person[];
  blockers: Person[];
  byStakeholder: { customers: string; investors: string; industry: string; regulators: string; media: string };
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
  stanceBefore: number | null;
  stanceAfter: number | null;
  createdAt: number;
}

export type RoomStatus = "generating" | "ready" | "error";
export type BuildStep = "plan" | "agents" | "bios" | "done";

export interface RoomInput {
  title: string;
  kind: RoomKind;
  description: string;
  region: string;
  targetHint: string;
}

export interface RoomState extends RoomInput {
  id: string;
  status: RoomStatus;
  /** Next audience build step; generation resumes from here after a restart. */
  step: BuildStep;
  audiencePlan: AudiencePlan | null;
  round: number;
  /** Admin pause. When true the engine never runs. */
  paused: boolean;
  running: boolean;
  lastRoundMs: number;
  createdAt: number;
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
  end: { stanceAfter: number; influencedBy: string[] } | null;
}
