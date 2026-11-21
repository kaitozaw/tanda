import { AGENT_TYPES, type EventType, type Post, type Scorecard } from "./types";
import type { Store } from "./store";

const ENGAGEMENT: EventType[] = ["like", "repost", "reply", "follow"];

/** The feedback numbers for one pitch (plan/PRODUCT.md → Feedback), from its events and seenBy. Pure. */
export function computeScorecard(store: Store, post: Post): Scorecard {
  const events = store.eventsByPost.get(post.id) ?? [];
  const segmentOf = (id: string) => store.agents.get(id)?.persona.type;

  /** Unique agents of a segment with an event of one of these types. */
  const who = (types: EventType[], segment: string) =>
    new Set(events.filter((e) => types.includes(e.type) && segmentOf(e.agentId) === segment).map((e) => e.agentId)).size;

  const c = post.counts;
  const reactions = c.like + c.repost + c.reply + c.follow + c.unfollow;
  return {
    views: c.impressions,
    reach: post.seenBy.length,
    reactionRate: c.impressions ? reactions / c.impressions : 0,
    segments: AGENT_TYPES.map((segment) => ({
      segment,
      seen: post.seenBy.filter((id) => segmentOf(id) === segment).length,
      reacted: who(ENGAGEMENT, segment),
      intent: who(["intent"], segment),
      objection: who(["objection"], segment),
    })),
  };
}
