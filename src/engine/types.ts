export type Side = "for" | "against" | "neutral";
export type AuthorType = "agent" | "member";

export interface Persona {
  name: string;
  age: number;
  region: string;
  role: string;
  segment: string;
  leaning: "left" | "centre" | "right";
  interests: string[];
  activity: number; // 0-1, how much they engage
  openness: number; // 0-1, how easily they change their mind
  bio: string;
}

export interface Agent {
  id: string;
  handle: string;
  persona: Persona;
  /** 0-100 support for the ban. */
  stance: number;
  followingIds: string[];
  followerIds: string[];
}

export interface Member {
  id: string;
  nickname: string;
  handle: string;
  followerIds: string[];
  lastPostAt: number;
  joinedAt: number;
}

export interface Counts {
  like: number;
  repost: number;
  reply: number;
  follow: number;
  unfollow: number;
  persuasion: number;
  backlash: number;
  neutralShift: number;
  impressions: number;
}

export interface Feedback {
  verdict: string;
  whatWorked: string[];
  improvements: string[];
  rewrite: string;
  stats: FeedbackStats;
}

export interface FeedbackStats {
  reach: number;
  engagementRate: number;
  backlashRisk: "low" | "medium" | "high";
  segments: { segment: string; engaged: number; persuaded: number; backlash: number }[];
}

export interface Post {
  id: string;
  authorType: AuthorType;
  authorId: string;
  text: string;
  side: Side;
  createdAt: number;
  createdRound: number;
  /** Rounds this post has been in the candidate pool. Final at rules.roundsToFinal. */
  roundsSeen: number;
  counts: Counts;
  points: number;
  finalized: boolean;
  feedback: Feedback | null;
  feedbackStatus: "none" | "pending" | "done" | "error";
}

export type EventType =
  | "like"
  | "repost"
  | "reply"
  | "follow"
  | "unfollow"
  | "persuasion"
  | "backlash"
  | "neutralShift";

export interface SimEvent {
  id: number;
  round: number;
  agentId: string;
  type: EventType;
  postId: string;
  /** Agent whose repost brought the post into this agent's feed (for the spread graph). */
  viaId: string | null;
  text: string | null;
  stanceBefore: number | null;
  stanceAfter: number | null;
  createdAt: number;
}

export interface RoomState {
  id: string;
  topic: string;
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
  post: string | null;
  end: { stanceAfter: number; influencedBy: string[] } | null;
}
