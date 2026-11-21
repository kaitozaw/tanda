import type { Server } from "socket.io";
import type { Agent, Counts, Member, Post, RoomInput, RoomState, SimEvent } from "./types";
import type { RoundEngine } from "./roundEngine";
import { rules } from "./config";

export const emptyCounts = (): Counts => ({
  like: 0, repost: 0, reply: 0, follow: 0, unfollow: 0,
  would_try: 0, would_pay: 0, want_meeting: 0, pass: 0, partner: 0, compete: 0,
  support: 0, concern: 0, would_cover: 0, objection: 0,
  persuasion: 0, backlash: 0,
  impressions: 0, impressionsViaRepost: 0,
});

export interface Snapshot {
  room: RoomState;
  agents: Agent[];
  members: Member[];
  posts: Post[];
  events: SimEvent[];
}

export const newRoomState = (id: string, input: RoomInput): RoomState => ({
  ...input,
  id,
  status: "generating",
  step: "plan",
  audiencePlan: null,
  round: 0,
  paused: false,
  running: false,
  lastRoundMs: 0,
  createdAt: Date.now(),
});

/** One room: its audience, members, posts and engagement log. */
export class Store {
  agents = new Map<string, Agent>();
  members = new Map<string, Member>();
  posts = new Map<string, Post>();
  /** Posts in creation order. */
  postOrder: string[] = [];
  events: SimEvent[] = [];
  eventsByPost = new Map<string, SimEvent[]>();
  eventSeq = 0;
  /** Last post time per member, for the post cooldown. Memory only: a restart just resets it. */
  lastPostAt = new Map<string, number>();

  constructor(public room: RoomState) {}

  /** Milliseconds until this member may post again (0 = now). Records the post when allowed. */
  takePostSlot(memberId: string, now = Date.now()): number {
    const wait = (this.lastPostAt.get(memberId) ?? -Infinity) + rules.postCooldownMs - now;
    if (wait > 0) return wait;
    this.lastPostAt.set(memberId, now);
    return 0;
  }

  author(post: Post): { handle: string; name: string; role: string } {
    if (post.authorType === "member") {
      const m = this.members.get(post.authorId);
      return { handle: m?.handle ?? "unknown", name: m?.nickname ?? "Unknown", role: "" };
    }
    const a = this.agents.get(post.authorId);
    return { handle: a?.handle ?? "unknown", name: a?.persona.name ?? "Unknown", role: a?.persona.role ?? "" };
  }

  addPost(post: Post) {
    this.posts.set(post.id, post);
    this.postOrder.push(post.id);
  }

  addEvent(e: Omit<SimEvent, "id" | "createdAt">): SimEvent {
    const ev: SimEvent = { ...e, id: ++this.eventSeq, createdAt: Date.now() };
    this.events.push(ev);
    const list = this.eventsByPost.get(ev.postId) ?? [];
    list.push(ev);
    this.eventsByPost.set(ev.postId, list);
    return ev;
  }

  agentList(): Agent[] {
    return [...this.agents.values()];
  }

  activePosts(): Post[] {
    return this.postOrder.map((id) => this.posts.get(id)!).filter((p) => !p.finalized);
  }

  pitches(): Post[] {
    return this.postOrder.map((id) => this.posts.get(id)!).filter((p) => p.authorType === "member");
  }

  /** Oldest pitch still waiting for its final score, or undefined. */
  oldestPendingPitch(): Post | undefined {
    return this.activePosts().find((p) => p.authorType === "member");
  }

  snapshot(): Snapshot {
    return {
      room: { ...this.room, running: false },
      agents: this.agentList(),
      members: [...this.members.values()],
      posts: this.postOrder.map((id) => this.posts.get(id)!),
      events: this.events,
    };
  }

  static restore(s: Snapshot): Store {
    const store = new Store({ ...s.room, running: false });
    store.agents = new Map(s.agents.map((a) => [a.id, a]));
    store.members = new Map(s.members.map((m) => [m.id, m]));
    store.posts = new Map(s.posts.map((p) => [p.id, p]));
    store.postOrder = s.posts.map((p) => p.id);
    for (const e of s.events) {
      store.events.push(e);
      const list = store.eventsByPost.get(e.postId) ?? [];
      list.push(e);
      store.eventsByPost.set(e.postId, list);
    }
    store.eventSeq = s.events.at(-1)?.id ?? 0;
    return store;
  }
}

export interface Room {
  store: Store;
  engine: RoundEngine;
}

/**
 * Process-wide singletons. Next.js bundles API routes separately from server.ts, so they are
 * shared through globalThis.
 */
type Sim = {
  rooms: Map<string, Room>;
  io?: Server;
  /** Claude requests today, across all rooms (daily cap). Memory only. */
  requests: { day: string; count: number };
  /** Scheduler interval (one for all rooms). */
  timer?: NodeJS.Timeout;
};
const g = globalThis as { __sim?: Sim };
export const sim: Sim = (g.__sim ??= { rooms: new Map(), requests: { day: "", count: 0 } });
export const getRoom = (id: string): Room | undefined => sim.rooms.get(id);

const today = () => new Date().toISOString().slice(0, 10);

/** Count Claude requests against the shared daily cap. */
export function countRequests(n: number) {
  if (sim.requests.day !== today()) sim.requests = { day: today(), count: 0 };
  sim.requests.count += n;
}

export function underDailyCap(cap: number): boolean {
  return sim.requests.day !== today() || sim.requests.count < cap;
}
