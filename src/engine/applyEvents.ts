import type { EventType, FeedItem, Persona, Post, SessionResult } from "./types";
import { emptyCounts, type Store } from "./store";
import { rules } from "./config";

export interface Notification {
  memberId: string;
  postId: string;
  type: EventType;
  handle: string;
  role: string;
  /** Acting agent's segment, so the client can phrase an intent ("wants a meeting"). */
  segment: string;
  text: string | null;
}

/** Engagement points by the agent's tier; intent points by its segment; objections score 0 (plan/PRODUCT.md → Scoring). */
export const pointsFor = (type: EventType, p: Pick<Persona, "tier" | "type">) =>
  type === "objection" ? 0 : type === "intent" ? rules.signals[p.type].intent.points : rules.points[type][p.tier];

const clipWords = (text: string, n: number) => text.split(/\s+/).filter(Boolean).slice(0, n).join(" ");

/**
 * Validate and apply one round of session results. Only posts that were in the agent's own feed
 * can be acted on, and signals only on pitches. Returns notifications for members whose pitches
 * got reactions.
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
    const { role, type: segment } = agent.persona;
    const inFeed = new Map(feed.map((it) => [it.post.id, it]));
    const isPitch = (postId: string) => inFeed.get(postId)?.post.authorType === "member";
    // A person likes, reposts, replies or signals once per post, even if it shows up again next round.
    const already = (type: EventType, postId: string) =>
      (store.eventsByPost.get(postId) ?? []).some((e) => e.agentId === agent.id && e.type === type);

    const record = (type: EventType, postId: string, text: string | null = null) => {
      const post = inFeed.get(postId)!.post;
      store.addEvent({ round, agentId: agent.id, type, postId, text });
      post.counts[type]++;
      post.points += pointsFor(type, agent.persona);
      if (post.authorType === "member") {
        notifications.push({ memberId: post.authorId, postId, type, handle: agent.handle, role, segment, text });
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
      if (!post || post.authorId === agent.id || agent.followingIds.includes(post.authorId) === on) return;
      const author = post.authorType === "member" ? store.members.get(post.authorId) : store.agents.get(post.authorId);
      agent.followingIds = on ? [...agent.followingIds, post.authorId] : agent.followingIds.filter((x) => x !== post.authorId);
      if (author) author.followerIds = on ? [...author.followerIds, agent.id] : author.followerIds.filter((x) => x !== agent.id);
      record(on ? "follow" : "unfollow", postId);
    };
    for (const id of new Set(r.follows)) setFollow(id, true);
    for (const id of new Set(r.unfollows)) setFollow(id, false);

    // Signals: private intent / objection on pitches, max 2 per session.
    let signals = 0;
    for (const s of r.signals) {
      if (signals >= rules.maxSignalsPerSession) break;
      if (!isPitch(s.postId) || already(s.kind, s.postId)) continue;
      signals++;
      record(s.kind, s.postId, clipWords(s.reason, rules.maxReasonWords) || null);
    }

    if (r.post && posters.has(agent.id)) {
      const post: Post = {
        id: `p${round}_${agent.id}`,
        authorType: "agent",
        authorId: agent.id,
        text: r.post.slice(0, rules.maxPostChars),
        createdAt: Date.now(),
        createdRound: round,
        roundsSeen: 0,
        seenBy: [],
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
