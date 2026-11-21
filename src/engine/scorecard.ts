import { AGENT_TYPES, type AgentType, type EventType, type Post, type Scorecard, type StakeholderRow } from "./types";
import type { Store } from "./store";

const POSITIVE = new Set<EventType>(["would_try", "would_pay", "want_meeting", "partner", "support", "would_cover", "persuasion"]);
const NEGATIVE = new Set<EventType>(["pass", "concern", "objection", "backlash"]);
const pct = (yes: number, seen: number) => (seen ? Math.round((yes / seen) * 1000) / 10 : 0);

/** The PRODUCT.md validation scorecard for one pitch, from its events and who saw it. */
export function computeScorecard(store: Store, post: Post): Scorecard {
  const events = store.eventsByPost.get(post.id) ?? [];
  const targetSegments = new Set((store.room.audiencePlan?.segments ?? []).filter((s) => s.kind === "target").map((s) => s.name));
  const typeOf = (id: string): AgentType | null => store.agents.get(id)?.persona.type ?? null;

  const seenByType = new Map<AgentType, number>();
  let targetSeen = 0;
  for (const id of post.seenBy) {
    const a = store.agents.get(id);
    if (!a) continue;
    seenByType.set(a.persona.type, (seenByType.get(a.persona.type) ?? 0) + 1);
    if (a.persona.type === "customer" && (targetSegments.size === 0 || targetSegments.has(a.persona.segment))) targetSeen++;
  }

  const rows = new Map<AgentType, StakeholderRow>(
    AGENT_TYPES.map((t) => [t, { type: t, seen: seenByType.get(t) ?? 0, positive: 0, negative: 0, avgShift: 0 }]),
  );
  const shiftSum = new Map<AgentType, number>();
  const unique = (type: EventType, filter: (agentId: string) => boolean = () => true) =>
    new Set(events.filter((e) => e.type === type && filter(e.agentId)).map((e) => e.agentId)).size;

  for (const e of events) {
    const t = typeOf(e.agentId);
    if (!t) continue;
    const row = rows.get(t)!;
    if (POSITIVE.has(e.type)) row.positive++;
    if (NEGATIVE.has(e.type)) row.negative++;
    if ((e.type === "persuasion" || e.type === "backlash") && e.stanceBefore !== null && e.stanceAfter !== null) {
      shiftSum.set(t, (shiftSum.get(t) ?? 0) + (e.stanceAfter - e.stanceBefore));
    }
  }
  for (const row of rows.values()) row.avgShift = row.seen ? Math.round(((shiftSum.get(row.type) ?? 0) / row.seen) * 10) / 10 : 0;

  const isTarget = (id: string) => {
    const a = store.agents.get(id);
    return !!a && a.persona.type === "customer" && (targetSegments.size === 0 || targetSegments.has(a.persona.segment));
  };
  const customersSeen = seenByType.get("customer") ?? 0;
  const tryYes = unique("would_try", isTarget);
  const payYes = unique("would_pay");

  const c = post.counts;
  return {
    reach: { unique: post.seenBy.length, impressions: c.impressions, viaRepostPct: pct(c.impressionsViaRepost, c.impressions) },
    demand: { seen: targetSeen, yes: tryYes, pct: pct(tryYes, targetSeen) },
    pay: { seen: customersSeen, yes: payYes, pct: pct(payYes, customersSeen) },
    investors: { seen: seenByType.get("investor") ?? 0, meeting: c.want_meeting, pass: c.pass },
    industry: { partner: c.partner, compete: c.compete },
    risk: {
      concerns: c.concern,
      reasons: events.filter((e) => e.type === "concern" && e.text).slice(0, 5).map((e) => e.text!),
    },
    stakeholders: [...rows.values()],
    objections: events
      .filter((e) => e.type === "objection" && e.text)
      .map((e) => ({ handle: store.agents.get(e.agentId)?.handle ?? "unknown", type: typeOf(e.agentId) ?? "customer", reason: e.text! })),
  };
}
