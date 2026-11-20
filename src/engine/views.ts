import type { Post, SimEvent } from "./types";
import { sim, type Store } from "./store";
import { config, rules } from "./config";

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
  const idle = sim.engine?.idleReason() ?? "starting";
  const timeline = store.postOrder.slice(-80).reverse().map((id) => postView(store, store.posts.get(id)!));
  const ranked = memberPosts(store).sort((a, b) => b.points - a.points);
  const leaderboard = ranked.slice(0, 10).map((p) => ({ ...postView(store, p), nickname: store.author(p).name }));

  const member = memberId ? store.members.get(memberId) : undefined;
  const me = member
    ? {
        id: member.id,
        nickname: member.nickname,
        handle: member.handle,
        followers: member.followerIds.length,
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
      points: rules.points,
    },
    stats: {
      agents: Math.min(store.agents.size, config.agentCount),
      members: store.members.size,
      posts: store.posts.size,
      // Reactions to human posts only (view changes are shown per post in the leaderboard).
      reactions: memberPosts(store).reduce((n, p) => n + p.counts.like + p.counts.repost + p.counts.reply + p.counts.follow + p.counts.unfollow, 0),
    },
    timeline,
    leaderboard,
    me,
  };
}
export type RoomView = ReturnType<typeof roomView>;
