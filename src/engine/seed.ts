import type { Agent, Member } from "./types";
import type { Store } from "./store";
import { rules } from "./config";

/** Small deterministic RNG, so a room's audience and graph are reproducible. */
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/** Stable numeric seed from a string (room id). */
export function hashSeed(text: string): number {
  let h = 2166136261;
  for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

/**
 * Barabási–Albert style graph: each agent follows `m` earlier agents, picked in proportion to how
 * many followers they already have. Gives a power-law follower count, and agents early in the
 * list become the influencers (the audience generator puts the power tier first).
 */
export function buildFollowGraph(agents: Agent[], m = 8, seed = 42) {
  const rand = rng(seed);
  const byId = new Map(agents.map((a) => [a.id, a]));
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
      byId.get(t)!.followerIds.push(a.id);
      targets.push(t);
    }
    targets.push(a.id);
  });
}

/** `follower` follows `target` (no-op if already following). */
export function follow(follower: Agent, target: Agent) {
  if (follower.id === target.id || follower.followingIds.includes(target.id)) return;
  follower.followingIds.push(target.id);
  target.followerIds.push(follower.id);
}

/**
 * Every member starts with exactly the same number of random crowd followers (fairness).
 * While the audience is still being built there are no agents yet; giveMemberFollowers runs
 * again for those members once it is ready.
 */
export function addMember(store: Store, nickname: string): Member {
  const id = `m${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
  const base = nickname.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 14) || "member";
  const member: Member = { id, nickname, handle: `${base}_${id.slice(-3)}`, followerIds: [], joinedAt: Date.now() };
  store.members.set(id, member);
  giveMemberFollowers(store, member);
  return member;
}

export function giveMemberFollowers(store: Store, member: Member) {
  if (member.followerIds.length > 0) return;
  const crowd = store.agentList().filter((a) => a.persona.tier === "crowd");
  if (crowd.length === 0) return;
  // 10% of the room's agents (100 of 1,000), drawn from the crowd.
  const n = Math.min(crowd.length, Math.max(1, Math.round((rules.memberStartFollowers * store.agents.size) / 1000)));
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(Math.random() * (crowd.length - i));
    [crowd[i], crowd[j]] = [crowd[j], crowd[i]];
    crowd[i].followingIds.push(member.id);
    member.followerIds.push(crowd[i].id);
  }
}
