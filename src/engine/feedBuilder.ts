import type { Agent, EventType, FeedItem, Post } from "./types";
import type { Store } from "./store";
import { rules } from "./config";

/**
 * Exposure planning (plan/PRODUCT.md → Round). Who sees a pitch depends only on that pitch's own
 * results, never on how many other pitches are live, so a pitch scores the same whenever it is posted:
 * - pitch round 1: the author's followers + a fixed-size random sample;
 * - later rounds: an audience sized by the previous round's reaction rate, drawn first from followers
 *   of agents who reacted to it (word of mouth), then at random.
 * Each agent's feed is its assigned pitches plus background posts (the room's starter posts), which
 * never change, so the surroundings are the same at any time.
 */

/** Reactions that count toward a pitch's spread. */
const SPREADS: EventType[] = ["like", "repost", "reply", "follow", "intent"];

/** Scale a per-1,000-agents number to the agents in use. */
const scaled = (n: number, agents: number) => Math.max(1, Math.round((n * agents) / 1000));

/** Share of last round's new viewers who reacted (like / repost / reply / follow / intent) in that round. */
export function reactionRate(store: Store, post: Post, round: number): number {
  const seen = post.audienceByRound?.at(-1) ?? 0;
  if (!seen) return 0;
  const reacted = new Set(
    (store.eventsByPost.get(post.id) ?? []).filter((e) => e.round === round && SPREADS.includes(e.type)).map((e) => e.agentId),
  );
  return Math.min(1, reacted.size / seen);
}

/** New viewers a pitch gets this round (round 1: the random sample, on top of the author's followers). */
export function audienceSize(store: Store, post: Post, agents: number): number {
  const x = rules.exposure;
  if (post.roundsSeen === 0) return scaled(x.seedRandom, agents);
  const rate = reactionRate(store, post, store.room.round);
  return scaled(x.minNext + (x.maxNext - x.minNext) * Math.min(1, rate / x.targetRate), agents);
}

const shuffle = <T,>(xs: T[], rand: () => number): T[] => {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/**
 * Build this round's feeds. Only agents with at least one pitch to see get a feed (and a session).
 * `agents` are the agents in use (AGENT_COUNT), `background` the room's starter posts.
 */
export function planFeeds(store: Store, pitches: Post[], background: Post[], agents: Agent[], rand = Math.random): Map<string, FeedItem[]> {
  const inUse = new Set(agents.map((a) => a.id));
  const assigned = new Map<string, FeedItem[]>();

  // Random order each round, so no pitch wins ties for an agent's limited pitch slots.
  for (const post of shuffle(pitches, rand)) {
    const seen = new Set(post.seenBy);
    const take = (agentId: string, viaId: string | null): boolean => {
      if (seen.has(agentId) || !inUse.has(agentId)) return false;
      const list = assigned.get(agentId) ?? [];
      if (list.length >= rules.feed.maxPitches) return false;
      list.push({ post, viaId });
      assigned.set(agentId, list);
      seen.add(agentId);
      return true;
    };
    const fillRandom = (n: number) => {
      let added = 0;
      for (const a of shuffle(agents, rand)) {
        if (added >= n) break;
        if (take(a.id, null)) added++;
      }
    };

    const target = audienceSize(store, post, agents.length);
    if (post.roundsSeen === 0) {
      // Round 1: every pitch starts from the same place: the author's followers + a random sample.
      // Followers it cannot reach (their pitch slots are full) are replaced at random, so the total stays.
      const followers = store.members.get(post.authorId)?.followerIds ?? [];
      const reached = followers.filter((id) => take(id, null)).length;
      fillRandom(target + followers.length - reached);
      continue;
    }
    // Word of mouth first: followers of agents who reacted to it (shown as reposted_by for reposters).
    const events = store.eventsByPost.get(post.id) ?? [];
    const reposters = new Set(events.filter((e) => e.type === "repost").map((e) => e.agentId));
    const reacted = new Set(events.filter((e) => SPREADS.includes(e.type)).map((e) => e.agentId));
    const candidates: [string, string | null][] = [];
    for (const id of reacted) {
      for (const f of store.agents.get(id)?.followerIds ?? []) candidates.push([f, reposters.has(id) ? id : null]);
    }
    let added = 0;
    for (const [id, via] of shuffle(candidates, rand)) {
      if (added >= target) break;
      if (take(id, via)) added++;
    }
    fillRandom(target - added);
  }

  // Fill each feed with background posts (never the agent's own), then mix the order.
  const feeds = new Map<string, FeedItem[]>();
  for (const [agentId, items] of assigned) {
    const fill = shuffle(background.filter((p) => p.authorId !== agentId), rand)
      .slice(0, Math.max(0, rules.feed.size - items.length))
      .map((post) => ({ post, viaId: null }));
    feeds.set(agentId, shuffle([...items, ...fill], rand));
  }
  return feeds;
}
