import { AGENT_TYPES, type Post, type SimEvent } from "./types";
import { sim, type Store } from "./store";
import { config, rules } from "./config";
import { getMarket, OPEN_MARKET } from "./markets";
import { computeScorecard } from "./scorecard";
import { pointsFor } from "./applyEvents";

/** Count and points per event type for one pitch (points depend on the acting agent's tier or segment). */
export function breakdown(store: Store, p: Post) {
  const rows = new Map<string, { type: string; count: number; points: number }>();
  for (const e of store.eventsByPost.get(p.id) ?? []) {
    const persona = store.agents.get(e.agentId)?.persona;
    const r = rows.get(e.type) ?? { type: e.type, count: 0, points: 0 };
    r.count++;
    if (persona) r.points += pointsFor(e.type, persona);
    rows.set(e.type, r);
  }
  return [...rows.values()];
}

export function postView(store: Store, p: Post) {
  const a = store.author(p);
  return {
    id: p.id,
    authorType: p.authorType,
    handle: a.handle,
    name: a.name,
    role: a.role,
    isPitch: p.authorType === "member",
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
    segment: a?.persona.type ?? "customer",
    text: e.text,
  };
}
export type EventView = ReturnType<typeof eventView>;

const memberPosts = (store: Store) => store.pitches();

/** Agents the engine uses, per type (the Dashboard's audience panel). */
function audience(store: Store) {
  const agents = store.activeAgents();
  return AGENT_TYPES.map((type) => ({ type, count: agents.filter((a) => a.persona.type === type).length }));
}

export function roomView(store: Store, memberId: string | null) {
  const idle = sim.engine?.idleReason() ?? "starting";
  const timeline = store.postOrder.slice(-80).reverse().map((id) => postView(store, store.posts.get(id)!));
  const ranked = memberPosts(store).sort((a, b) => b.points - a.points);
  const leaderboard = ranked.slice(0, 10).map((p) => ({ ...postView(store, p), nickname: store.author(p).name, scorecard: computeScorecard(store, p), breakdown: breakdown(store, p) }));

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
            scorecard: computeScorecard(store, p),
            activity: (store.eventsByPost.get(p.id) ?? []).slice(-40).reverse().map((e) => eventView(store, e)),
            feedback: p.feedback,
            feedbackStatus: p.feedbackStatus,
          })),
      }
    : null;

  const market = getMarket(store.room.id) ?? OPEN_MARKET;
  return {
    room: {
      id: store.room.id,
      market: { name: market.name, region: market.region, tagline: market.tagline },
      round: store.room.round,
      status: store.room.running ? "running" : idle ?? "running",
      lastRoundMs: store.room.lastRoundMs,
      roundsToFinal: rules.roundsToFinal,
      simMinutesPerRound: rules.simMinutesPerRound,
      points: rules.points,
      signals: rules.signals,
    },
    stats: {
      agents: Math.min(store.agents.size, config.agentCount),
      members: store.members.size,
      pitches: memberPosts(store).length,
      // Reactions to human posts only (view changes are shown per post in the leaderboard).
      reactions: memberPosts(store).reduce((n, p) => n + p.counts.like + p.counts.repost + p.counts.reply + p.counts.follow + p.counts.unfollow, 0),
    },
    audience: audience(store),
    timeline,
    leaderboard,
    me,
  };
}
export type RoomView = ReturnType<typeof roomView>;
