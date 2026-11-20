import type { Server } from "socket.io";
import type { Notification } from "./applyEvents";

type Globals = { __simIo?: Server };
const g = globalThis as Globals;

export const setIo = (io: Server) => (g.__simIo = io);
const io = () => g.__simIo;

export const roomChannel = (roomId: string) => `room:${roomId}`;
export const memberChannel = (memberId: string) => `member:${memberId}`;

/** Tell every client in the room to refetch state. */
export function broadcastRefresh(roomId: string, payload: Record<string, unknown> = {}) {
  io()?.to(roomChannel(roomId)).emit("refresh", payload);
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
