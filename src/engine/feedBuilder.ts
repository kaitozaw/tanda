import type { Agent, FeedItem, Post } from "./types";
import { rules } from "./config";
import { rank } from "./rank";

export interface FeedContext {
  /** Posts that are not final yet, in creation order. */
  pool: Post[];
  /** postId -> agentIds who reposted it (still active posts only). */
  repostsByPost: Map<string, string[]>;
  rand: () => number;
}

/** Shared per-round data so building 1,000 feeds stays cheap. */
export function prepare(pool: Post[], repostsByPost: Map<string, string[]>, rand = Math.random) {
  const ranked = [...pool].sort((a, b) => rank(b) - rank(a));
  const fresh = pool.filter((p) => p.roundsSeen === 0);
  return { pool, ranked, fresh, repostsByPost, rand };
}

export type Prepared = ReturnType<typeof prepare>;

export function buildFeed(agent: Agent, ctx: Prepared): FeedItem[] {
  const { follows, recommended, exploration } = rules.feed;
  const following = new Set(agent.followingIds);
  const chosen = new Set<string>();
  const items: FeedItem[] = [];
  const isOwn = (p: Post) => p.authorType === "agent" && p.authorId === agent.id;

  // 1. Follows: posts by accounts it follows, or reposted by agents it follows. Newest first.
  const followCandidates: FeedItem[] = [];
  for (let i = ctx.pool.length - 1; i >= 0; i--) {
    const p = ctx.pool[i];
    if (isOwn(p)) continue;
    if (following.has(p.authorId)) {
      followCandidates.push({ post: p, viaId: null, slot: "follow" });
      continue;
    }
    const via = ctx.repostsByPost.get(p.id)?.find((id) => following.has(id) && id !== agent.id);
    if (via) followCandidates.push({ post: p, viaId: via, slot: "follow" });
  }
  // Mix rank and recency: take the best-ranked among the newest candidates.
  followCandidates
    .slice(0, follows * 3)
    .sort((a, b) => rank(b.post) - rank(a.post))
    .slice(0, follows)
    .forEach((it) => {
      items.push(it);
      chosen.add(it.post.id);
    });

  // 2. Exploration: random brand-new posts, so new posts always get some reach.
  const fresh = ctx.fresh.filter((p) => !chosen.has(p.id) && !isOwn(p));
  for (let e = 0; e < exploration && fresh.length > 0; e++) {
    const i = Math.floor(ctx.rand() * fresh.length);
    const p = fresh.splice(i, 1)[0];
    items.push({ post: p, viaId: null, slot: "exploration" });
    chosen.add(p.id);
  }

  // 3. Recommended: best-ranked posts from accounts it does not follow. Also fills slots left
  // empty above, so a feed is full whenever there are enough posts.
  const total = follows + recommended + exploration;
  for (const p of ctx.ranked) {
    if (items.length >= total) break;
    if (chosen.has(p.id) || isOwn(p) || following.has(p.authorId)) continue;
    items.push({ post: p, viaId: null, slot: "recommended" });
    chosen.add(p.id);
  }

  // Shuffle lightly so slot order does not leak into behaviour.
  return items.sort(() => ctx.rand() - 0.5);
}
