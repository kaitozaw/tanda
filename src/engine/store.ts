import type { Server } from "socket.io";
import type { Agent, Counts, Member, Post, RoomState, SimEvent } from "./types";
import type { RoundEngine } from "./roundEngine";
import { config, rules } from "./config";

export const emptyCounts = (): Counts => ({
  like: 0,
  repost: 0,
  reply: 0,
  follow: 0,
  unfollow: 0,
  persuasion: 0,
  backlash: 0,
  neutralShift: 0,
  impressions: 0,
});

export interface Snapshot {
  room: RoomState;
  agents: Agent[];
  members: Member[];
  posts: Post[];
  events: SimEvent[];
}

export class Store {
  room: RoomState = {
    id: rules.roomId,
    topic: rules.topic,
    round: 0,
    paused: false,
    running: false,
    lastRoundMs: 0,
    requestDay: "",
    requestCount: 0,
  };
  agents = new Map<string, Agent>();
  members = new Map<string, Member>();
  posts = new Map<string, Post>();
  /** Posts in creation order. */
  postOrder: string[] = [];
  events: SimEvent[] = [];
  eventsByPost = new Map<string, SimEvent[]>();
  eventSeq = 0;

  author(post: Post): { handle: string; name: string } {
    if (post.authorType === "member") {
      const m = this.members.get(post.authorId);
      return { handle: m?.handle ?? "unknown", name: m?.nickname ?? "Unknown" };
    }
    const a = this.agents.get(post.authorId);
    return { handle: a?.handle ?? "unknown", name: a?.persona.name ?? "Unknown" };
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

  /** Agents the engine uses: capped by AGENT_COUNT even if more were restored from Postgres. */
  activeAgents(): Agent[] {
    return [...this.agents.values()].slice(0, config.agentCount);
  }

  activePosts(): Post[] {
    return this.postOrder.map((id) => this.posts.get(id)!).filter((p) => !p.finalized);
  }

  hasPendingHumanPosts(): boolean {
    return this.activePosts().some((p) => p.authorType === "member");
  }

  snapshot(): Snapshot {
    return {
      room: { ...this.room, running: false },
      agents: [...this.agents.values()],
      members: [...this.members.values()],
      posts: this.postOrder.map((id) => this.posts.get(id)!),
      events: this.events,
    };
  }

  restore(s: Snapshot) {
    this.room = { ...s.room, running: false };
    this.agents = new Map(s.agents.map((a) => [a.id, a]));
    this.members = new Map(s.members.map((m) => [m.id, m]));
    this.posts = new Map(s.posts.map((p) => [p.id, p]));
    this.postOrder = s.posts.map((p) => p.id);
    this.events = [];
    this.eventsByPost = new Map();
    for (const e of s.events) {
      this.events.push(e);
      const list = this.eventsByPost.get(e.postId) ?? [];
      list.push(e);
      this.eventsByPost.set(e.postId, list);
    }
    this.eventSeq = s.events.at(-1)?.id ?? 0;
  }
}

/**
 * Process-wide singletons. Next.js bundles API routes separately from server.ts, so they are
 * shared through globalThis.
 */
type Sim = { store: Store; engine?: RoundEngine; io?: Server };
const g = globalThis as { __sim?: Sim };
export const sim: Sim = (g.__sim ??= { store: new Store() });
export const getStore = () => sim.store;
