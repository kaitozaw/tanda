import type { Post, SimEvent } from "./types";
import type { Store } from "./store";
import { config, rules } from "./config";
import { getEngine } from "./roundEngine";

export function postView(store: Store, p: Post) {
  const a = store.author(p);
  return {
    id: p.id,
    authorType: p.authorType,
    handle: a.handle,
    name: a.name,
    text: p.text,
    side: p.side,
    counts: p.counts,
    points: p.points,
    roundsSeen: p.roundsSeen,
    finalized: p.finalized,
    createdAt: p.createdAt,
  };
}
export type PostView = ReturnType<typeof postView>;

export function eventView(store: Store, e: SimEvent) {
  const a = store.agents.get(e.agentId);
  return {
    id: e.id,
    round: e.round,
    type: e.type,
    handle: a?.handle ?? "unknown",
    name: a?.persona.name ?? "",
    role: a?.persona.role ?? "",
    segment: a?.persona.segment ?? "",
    text: e.text,
    stanceBefore: e.stanceBefore,
    stanceAfter: e.stanceAfter,
  };
}
export type EventView = ReturnType<typeof eventView>;

const memberPosts = (store: Store) =>
  store.postOrder.map((id) => store.posts.get(id)!).filter((p) => p.authorType === "member");

export function roomView(store: Store, memberId: string | null) {
  const engine = getEngine();
  const idle = engine?.idleReason() ?? "starting";
  const timeline = store.postOrder.slice(-80).reverse().map((id) => postView(store, store.posts.get(id)!));
  const ranked = memberPosts(store).sort((a, b) => b.points - a.points);
  const leaderboard = ranked.slice(0, 10).map((p) => ({ ...postView(store, p), nickname: store.author(p).name }));

  const topPost = ranked[0];
  const top = topPost
    ? {
        post: postView(store, topPost),
        replies: (store.eventsByPost.get(topPost.id) ?? []).filter((e) => e.type === "reply").slice(-5).map((e) => eventView(store, e)),
        persuaded: (store.eventsByPost.get(topPost.id) ?? []).filter((e) => e.type === "persuasion").slice(-5).map((e) => eventView(store, e)),
      }
    : null;

  const member = memberId ? store.members.get(memberId) : undefined;
  const me = member
    ? {
        id: member.id,
        nickname: member.nickname,
        handle: member.handle,
        followers: member.followerIds.length,
        cooldownMs: Math.max(0, member.lastPostAt + rules.postCooldownMs - Date.now()),
        posts: memberPosts(store)
          .filter((p) => p.authorId === member.id)
          .reverse()
          .map((p) => ({
            ...postView(store, p),
            activity: (store.eventsByPost.get(p.id) ?? []).slice(-40).reverse().map((e) => eventView(store, e)),
            feedback: p.feedback,
            feedbackStatus: p.feedbackStatus,
          })),
      }
    : null;

  return {
    room: {
      id: store.room.id,
      topic: store.room.topic,
      round: store.room.round,
      status: store.room.running ? "running" : idle ?? "running",
      lastRoundMs: store.room.lastRoundMs,
      roundsToFinal: rules.roundsToFinal,
      simMinutesPerRound: rules.simMinutesPerRound,
    },
    stats: {
      agents: Math.min(store.agents.size, config.agentCount),
      members: store.members.size,
      posts: store.posts.size,
      events: store.events.length,
    },
    timeline,
    leaderboard,
    top,
    me,
  };
}
export type RoomView = ReturnType<typeof roomView>;

/** Nodes and links showing how a post spread: author -> agents, or reposter -> agents. */
export function spreadView(store: Store, postId: string) {
  const post = store.posts.get(postId);
  if (!post) return null;
  const author = store.author(post);
  const nodes = new Map<string, { id: string; label: string; kind: string }>();
  const links: { source: string; target: string; kind: string }[] = [];
  nodes.set(post.authorId, { id: post.authorId, label: `@${author.handle}`, kind: "author" });
  for (const e of store.eventsByPost.get(postId) ?? []) {
    const a = store.agents.get(e.agentId);
    const existing = nodes.get(e.agentId);
    const rankOrder = ["like", "reply", "repost", "persuasion", "backlash"];
    const kind = existing && rankOrder.indexOf(existing.kind) > rankOrder.indexOf(e.type) ? existing.kind : e.type;
    nodes.set(e.agentId, { id: e.agentId, label: `@${a?.handle} (${a?.persona.role})`, kind });
    if (!existing) links.push({ source: e.viaId && nodes.has(e.viaId) ? e.viaId : post.authorId, target: e.agentId, kind: e.viaId ? "via-repost" : "direct" });
  }
  return { nodes: [...nodes.values()], links };
}
