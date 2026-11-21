import type { Post, SimEvent } from "./types";
import type { Room, Store } from "./store";
import { config, rules } from "./config";
import { audienceSummary } from "./audience";
import { computeScorecard } from "./scorecard";
import { roomStatus } from "./scheduler";

export function postView(store: Store, p: Post) {
  const a = store.author(p);
  return {
    id: p.id,
    authorType: p.authorType,
    isPitch: p.authorType === "member",
    handle: a.handle,
    name: a.name,
    role: a.role,
    text: p.text,
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
    agentType: a?.persona.type ?? "customer",
    segment: a?.persona.segment ?? "",
    text: e.text,
    stanceBefore: e.stanceBefore,
    stanceAfter: e.stanceAfter,
  };
}
export type EventView = ReturnType<typeof eventView>;

const SIGNAL_TYPES = new Set(Object.values(rules.signals).flat());

export function roomView({ store, engine }: Room, memberId: string | null) {
  const r = store.room;
  const timeline = store.postOrder.slice(-80).reverse().map((id) => postView(store, store.posts.get(id)!));
  const pitches = store.pitches();
  const withScore = (p: Post) => ({ ...postView(store, p), nickname: store.author(p).name, scorecard: computeScorecard(store, p) });
  const leaderboard = [...pitches].sort((a, b) => b.points - a.points).slice(0, 20).map(withScore);

  const member = memberId ? store.members.get(memberId) : undefined;
  const me = member
    ? {
        id: member.id,
        nickname: member.nickname,
        handle: member.handle,
        followers: member.followerIds.length,
        posts: pitches
          .filter((p) => p.authorId === member.id)
          .reverse()
          .map((p) => ({
            ...withScore(p),
            activity: (store.eventsByPost.get(p.id) ?? []).slice(-60).reverse().map((e) => eventView(store, e)),
            feedback: p.feedback,
            feedbackStatus: p.feedbackStatus,
          })),
      }
    : null;

  return {
    room: {
      id: r.id,
      title: r.title,
      kind: r.kind,
      description: r.description,
      region: r.region,
      buildStatus: r.status,
      step: r.step,
      status: roomStatus({ store, engine }),
      round: r.round,
      lastRoundMs: r.lastRoundMs,
      roundsToFinal: rules.roundsToFinal,
      simMinutesPerRound: rules.simMinutesPerRound,
      points: rules.points,
    },
    audience: audienceSummary(store),
    stats: {
      agents: store.agents.size || config.agentCount,
      members: store.members.size,
      pitches: pitches.length,
      reactions: pitches.reduce((n, p) => n + p.counts.like + p.counts.repost + p.counts.reply + p.counts.follow + p.counts.unfollow, 0),
      signals: pitches.reduce((n, p) => n + [...SIGNAL_TYPES].reduce((m, k) => m + p.counts[k], 0), 0),
    },
    timeline,
    leaderboard,
    me,
  };
}
export type RoomView = ReturnType<typeof roomView>;
export type PitchView = RoomView["leaderboard"][number];
