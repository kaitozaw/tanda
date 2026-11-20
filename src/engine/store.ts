import type { Agent, Counts, Member, Post, RoomState, SimEvent } from "./types";
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

  /** Changes not yet saved to Postgres. */
  dirty = {
    agents: new Set<string>(),
    members: new Set<string>(),
    posts: new Set<string>(),
    events: [] as SimEvent[],
    room: false,
  };

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
    this.dirty.posts.add(post.id);
  }

  addEvent(e: Omit<SimEvent, "id" | "createdAt">): SimEvent {
    const ev: SimEvent = { ...e, id: ++this.eventSeq, createdAt: Date.now() };
    this.events.push(ev);
    const list = this.eventsByPost.get(ev.postId) ?? [];
    list.push(ev);
    this.eventsByPost.set(ev.postId, list);
    this.dirty.events.push(ev);
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
    for (const id of this.postOrder) {
      const p = this.posts.get(id)!;
      if (p.authorType === "member" && !p.finalized) return true;
    }
    return false;
  }

  markRoomDirty() {
    this.dirty.room = true;
  }
}

type Globals = { __simStore?: Store };
const g = globalThis as Globals;

/** One store per process, shared by server.ts and Next.js API routes (bundled separately). */
export function getStore(): Store {
  if (!g.__simStore) g.__simStore = new Store();
  return g.__simStore;
}
