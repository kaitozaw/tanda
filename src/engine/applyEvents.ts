import type { EventType, FeedItem, Post, SessionResult, Side } from "./types";
import { emptyCounts, type Store } from "./store";
import { rules } from "./config";

export interface Notification {
  memberId: string;
  postId: string;
  type: EventType;
  handle: string;
  text: string | null;
}

export const pointsFor = (type: EventType) => rules.points[type];

export function sideFromStance(stance: number): Side {
  return stance >= 60 ? "for" : stance <= 40 ? "against" : "neutral";
}

/** Persuasion / Backlash / Neutral shift for one influencing post, or null if the change is too small. */
export function classifyShift(side: Side, before: number, after: number): EventType | null {
  const delta = after - before;
  if (Math.abs(delta) < rules.stanceThreshold) return null;
  if (side === "neutral") return "neutralShift";
  const toward = side === "for" ? delta > 0 : delta < 0;
  return toward ? "persuasion" : "backlash";
}

/**
 * Validate and apply one round of session results. Only posts that were in the agent's own feed
 * can be acted on. Returns notifications for members whose posts got reactions.
 */
export function applyResults(
  store: Store,
  round: number,
  feeds: Map<string, FeedItem[]>,
  results: SessionResult[],
  posters: Set<string>,
): { notifications: Notification[]; newPosts: Post[] } {
  const notifications: Notification[] = [];
  const newPosts: Post[] = [];

  for (const r of results) {
    const agent = store.agents.get(r.agentId);
    const feed = feeds.get(r.agentId);
    if (!agent || !feed) continue;
    const inFeed = new Map(feed.map((it) => [it.post.id, it]));
    // A person likes, reposts or replies to a post once, even if it shows up again next round.
    const already = (type: EventType, postId: string) =>
      (store.eventsByPost.get(postId) ?? []).some((e) => e.agentId === agent.id && e.type === type);

    const record = (type: EventType, postId: string, text: string | null = null, before: number | null = null, after: number | null = null) => {
      const item = inFeed.get(postId)!;
      const post = item.post;
      store.addEvent({ round, agentId: agent.id, type, postId, text, stanceBefore: before, stanceAfter: after });
      post.counts[type]++;
      post.points += pointsFor(type);
      if (post.authorType === "member") {
        notifications.push({ memberId: post.authorId, postId, type, handle: agent.handle, text });
      }
    };

    for (const id of new Set(r.likes)) if (inFeed.has(id) && !already("like", id)) record("like", id);
    for (const id of new Set(r.reposts)) if (inFeed.has(id) && !already("repost", id)) record("repost", id);
    const replied = new Set<string>();
    for (const { postId, text } of r.replies.slice(0, rules.maxRepliesPerSession)) {
      if (!inFeed.has(postId) || replied.has(postId) || already("reply", postId)) continue;
      replied.add(postId);
      record("reply", postId, text.slice(0, 280));
    }

    // follow / unfollow the author of a post in the feed (the post gets the points).
    const setFollow = (postId: string, on: boolean) => {
      const post = inFeed.get(postId)?.post;
      if (!post || agent.followingIds.includes(post.authorId) === on) return;
      const author = post.authorType === "member" ? store.members.get(post.authorId) : store.agents.get(post.authorId);
      agent.followingIds = on ? [...agent.followingIds, post.authorId] : agent.followingIds.filter((x) => x !== post.authorId);
      if (author) author.followerIds = on ? [...author.followerIds, agent.id] : author.followerIds.filter((x) => x !== agent.id);
      record(on ? "follow" : "unfollow", postId);
    };
    for (const id of new Set(r.follows)) setFollow(id, true);
    for (const id of new Set(r.unfollows)) setFollow(id, false);

    if (r.end) {
      const before = agent.stance;
      const after = Math.max(0, Math.min(100, Math.round(r.end.stanceAfter)));
      agent.stance = after;
      // Only posts the agent named, that were in its feed, count (max 2 to stop "credit everyone").
      const named = [...new Set(r.end.influencedBy)].filter((id) => inFeed.has(id)).slice(0, 2);
      for (const id of named) {
        const type = classifyShift(inFeed.get(id)!.post.side, before, after);
        if (type) record(type, id, null, before, after);
      }
    }

    if (r.post && posters.has(agent.id)) {
      const post: Post = {
        id: `p${round}_${agent.id}`,
        authorType: "agent",
        authorId: agent.id,
        text: r.post.slice(0, rules.maxPostChars),
        side: sideFromStance(agent.stance),
        createdAt: Date.now(),
        createdRound: round,
        roundsSeen: 0,
        counts: emptyCounts(),
        points: 0,
        finalized: false,
        feedback: null,
        feedbackStatus: "none",
      };
      store.addPost(post);
      newPosts.push(post);
    }
  }
  return { notifications, newPosts };
}

/** Count the round for every post in the pool; posts that reach the limit become final. */
export function finalizeRound(store: Store, pool: Post[]): Post[] {
  const finalized: Post[] = [];
  for (const p of pool) {
    p.roundsSeen++;
    if (p.roundsSeen >= rules.roundsToFinal) {
      p.finalized = true;
      if (p.authorType === "member") {
        p.feedbackStatus = "pending";
        finalized.push(p);
      }
    }
  }
  return finalized;
}
