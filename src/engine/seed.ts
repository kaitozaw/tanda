import fs from "node:fs";
import path from "node:path";
import type { Agent, Segment, Member } from "./types";
import { Store, emptyCounts } from "./store";
import { rules } from "./config";

type AgentSeed = Pick<Agent, "id" | "handle" | "persona">;

/** The room's personas, from data/rooms/<roomId>/agents.json (scripts/generate-agents.ts). */
export function loadAgentSeeds(roomId: string, dir = path.resolve("data/rooms")): AgentSeed[] {
  const file = path.join(dir, roomId, "agents.json");
  return JSON.parse(fs.readFileSync(/*turbopackIgnore: true*/ file, "utf8")) as AgentSeed[];
}

/** Small deterministic RNG so the follow graph is the same on every boot. */
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/**
 * Barabási–Albert style graph: each agent follows `m` earlier agents, picked in proportion to how
 * many followers they already have. Gives a power-law follower count (a few influencers).
 */
export function buildFollowGraph(agents: Agent[], m = 8, seed = 42) {
  const rand = rng(seed);
  const targets: string[] = []; // one entry per follower (+1 base), for preferential picking
  agents.forEach((a, i) => {
    const chosen = new Set<string>();
    if (i > 0) {
      const want = Math.min(m, i);
      while (chosen.size < want) {
        const t = rand() < 0.2 || targets.length === 0 ? agents[Math.floor(rand() * i)].id : targets[Math.floor(rand() * targets.length)];
        if (t !== a.id) chosen.add(t);
      }
    }
    for (const t of chosen) {
      a.followingIds.push(t);
      const target = agents.find((x) => x.id === t)!;
      target.followerIds.push(a.id);
      targets.push(t);
    }
    targets.push(a.id);
  });
}

/** a follows b (no self-follows, no duplicates). */
export function follow(a: Agent, b: Agent) {
  if (a.id === b.id || a.followingIds.includes(b.id)) return;
  a.followingIds.push(b.id);
  b.followerIds.push(a.id);
}

/**
 * Power accounts go first in the power law so they collect the most followers (shuffled within each
 * tier). Then media follow everyone in the power tier and investors follow industry leads.
 */
export function connectAgents(agents: Agent[], seed = 7) {
  const rand = rng(seed);
  const power = agents.filter((a) => a.persona.tier === "power").sort(() => rand() - 0.5);
  const crowd = agents.filter((a) => a.persona.tier === "crowd").sort(() => rand() - 0.5);
  buildFollowGraph([...power, ...crowd]);
  for (const a of power) {
    if (a.persona.segment === "media") for (const b of power) follow(a, b);
    if (a.persona.segment === "investor") for (const b of power) if (b.persona.segment === "industry_lead") follow(a, b);
  }
}

export function seedAgents(store: Store, seeds = loadAgentSeeds(store.room.id)) {
  store.agents.clear();
  // Seed all personas; AGENT_COUNT caps how many the engine uses (Store.activeAgents).
  const agents: Agent[] = seeds.map((s) => ({
    ...s,
    persona: { ...s.persona },
    followingIds: [],
    followerIds: [],
  }));
  connectAgents(agents);
  for (const a of agents) store.agents.set(a.id, a);
}

type PostSeed = { segment: Segment; text: string };

/** Starter posts for a room, from data/rooms/<roomId>/posts.json. No file = no starter posts. */
export function loadPostSeeds(roomId: string, dir = path.resolve("data/rooms")): PostSeed[] {
  const file = path.join(dir, roomId, "posts.json");
  if (!fs.existsSync(/*turbopackIgnore: true*/ file)) return [];
  return JSON.parse(fs.readFileSync(/*turbopackIgnore: true*/ file, "utf8")) as PostSeed[];
}

/**
 * Put the room's starter posts on the timeline, so it is not empty before anyone pitches. Each one
 * gets an active agent of the post's segment (deterministic, one post per agent), and they are spaced
 * a few minutes apart, oldest first.
 */
export function seedPosts(store: Store, seeds = loadPostSeeds(store.room.id), now = Date.now()) {
  const rand = rng(11);
  const used = new Set<string>();
  const agents = store.activeAgents();
  seeds.forEach((s, i) => {
    const pool = agents.filter((a) => a.persona.segment === s.segment && !used.has(a.id));
    if (pool.length === 0) return;
    const author = pool[Math.floor(rand() * pool.length)];
    used.add(author.id);
    store.addPost({
      id: `seed${String(i + 1).padStart(2, "0")}`,
      authorType: "agent",
      authorId: author.id,
      text: s.text.slice(0, rules.maxPostChars),
      createdAt: now - (seeds.length - i) * 3 * 60_000,
      createdRound: 0,
      roundsSeen: 0,
      seenBy: [],
      counts: emptyCounts(),
      points: 0,
      finalized: false,
      feedback: null,
      feedbackStatus: "none",
    });
  });
}

/** A fresh room: agents with their follow graph, then the starter posts. */
export function seedRoom(store: Store) {
  seedAgents(store);
  seedPosts(store);
}

/** Every member starts with exactly the same number of random crowd followers (fairness). */
export function addMember(store: Store, nickname: string): Member {
  const id = `m${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
  const base = nickname.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 14) || "member";
  const member: Member = {
    id,
    nickname,
    handle: `${base}_${id.slice(-3)}`,
    followerIds: [],
    joinedAt: Date.now(),
  };
  const active = store.activeAgents();
  const ids = active.filter((a) => a.persona.tier === "crowd").map((a) => a.id);
  // 10% of the active agents (100 of 1,000), so new followers stay possible at small AGENT_COUNT.
  const n = Math.min(ids.length, Math.max(1, Math.round((rules.memberStartFollowers * active.length) / 1000)));
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(Math.random() * (ids.length - i));
    [ids[i], ids[j]] = [ids[j], ids[i]];
    const agent = store.agents.get(ids[i])!;
    agent.followingIds.push(id);
    member.followerIds.push(agent.id);
  }
  store.members.set(id, member);
  return member;
}
