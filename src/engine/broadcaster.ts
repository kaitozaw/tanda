import type { Notification } from "./applyEvents";
import { config } from "./config";
import { sim } from "./store";

const io = () => sim.io;

export const roomChannel = (roomId: string) => `room:${roomId}`;
export const memberChannel = (memberId: string) => `member:${memberId}`;

/**
 * Throttle state per room. Kept on globalThis: API routes and server.ts are bundled separately,
 * so module-level state would exist twice and each copy would throttle on its own.
 */
type Throttle = { last: number; timer: NodeJS.Timeout | null; payload: Record<string, unknown> };
const g = globalThis as { __refresh?: Map<string, Throttle> };
const throttles = (g.__refresh ??= new Map());

/**
 * Tell every client in the room to refetch state, at most once per REFRESH_MS.
 * Every client refetches on each "refresh", so without this, 100 people posting at once means
 * 100 × 100 GETs. Calls inside the window are merged into one trailing emit.
 */
export function broadcastRefresh(roomId: string, payload: Record<string, unknown> = {}) {
  const t = throttles.get(roomId) ?? { last: 0, timer: null, payload: {} };
  throttles.set(roomId, t);
  t.payload = { ...t.payload, ...payload };
  if (t.timer) return;
  const emit = () => {
    t.timer = null;
    t.last = Date.now();
    const p = t.payload;
    t.payload = {};
    io()?.to(roomChannel(roomId)).emit("refresh", p);
  };
  const wait = t.last + config.refreshMs - Date.now();
  if (wait <= 0) emit();
  else t.timer = setTimeout(emit, wait);
}

export function notifyMembers(notifications: Notification[]) {
  const byMember = new Map<string, Notification[]>();
  for (const n of notifications) {
    const list = byMember.get(n.memberId) ?? [];
    list.push(n);
    byMember.set(n.memberId, list);
  }
  for (const [memberId, list] of byMember) {
    // Replies and persuasion first: they are the interesting ones.
    const order = ["persuasion", "reply", "repost", "follow", "backlash", "unfollow", "neutralShift", "like"];
    list.sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
    io()?.to(memberChannel(memberId)).emit("notify", { items: list.slice(0, 4), total: list.length });
  }
}

export function notifyFeedback(memberId: string, postId: string) {
  io()?.to(memberChannel(memberId)).emit("feedback", { postId });
}
