"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type { RoomView } from "@/engine/views";

export interface Toast {
  id: number;
  title: string;
  body: string | null;
}

interface NotifyItem { type: string; handle: string; segment: string; text: string | null }

const VERB: Record<string, string> = {
  like: "liked your pitch",
  repost: "reposted your pitch",
  reply: "replied",
  follow: "followed you",
  unfollow: "unfollowed you",
  objection: "raised an objection",
};
/** What an intent means per segment. */
const INTENT_VERB: Record<string, string> = {
  customer: "would pay for it",
  investor: "wants a meeting",
  industry_lead: "wants to partner",
  regulator: "supports it",
  media: "would cover it",
};

export function useRoom(roomId: string) {
  const [memberId, setMemberId] = useState<string | null>(null);
  const [view, setView] = useState<RoomView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [unread, setUnread] = useState(0);
  const socketRef = useRef<Socket | null>(null);
  const seq = useRef(0);
  const storageKey = `member:${roomId}`;

  useEffect(() => {
    try {
      setMemberId(localStorage.getItem(storageKey));
    } catch {
      /* storage blocked: user joins again */
    }
  }, [storageKey]);

  const load = useCallback(async () => {
    const q = memberId ? `?member=${memberId}` : "";
    const res = await fetch(`/api/rooms/${roomId}${q}`, { cache: "no-store" }).catch(() => null);
    if (!res?.ok) {
      setError(res?.status === 404 ? "Room not found" : "Could not load the room");
      return;
    }
    const data = (await res.json()) as RoomView;
    setView(data);
    setError(null);
    if (memberId && !data.me) {
      // Server was reset: forget the old member.
      try { localStorage.removeItem(storageKey); } catch {}
      setMemberId(null);
    }
  }, [roomId, memberId, storageKey]);

  // One fetch at a time. Requests that arrive meanwhile become a single follow-up fetch, so a
  // burst of pushes costs at most two GETs and an older response never overwrites a newer one.
  const inFlight = useRef(false);
  const again = useRef(false);
  const refresh = useCallback(async () => {
    if (inFlight.current) {
      again.current = true;
      return;
    }
    inFlight.current = true;
    try {
      do {
        again.current = false;
        await load();
      } while (again.current);
    } finally {
      inFlight.current = false;
    }
  }, [load]);

  useEffect(() => {
    void refresh();
    const socket = io();
    socketRef.current = socket;
    socket.on("connect", () => socket.emit("join", { roomId, memberId }));
    // Spread the room's refetches over half a second instead of all hitting the server at once.
    socket.on("refresh", () => void setTimeout(() => void refresh(), Math.random() * 500));
    socket.on("feedback", () => {
      void refresh();
      pushToast("Your feedback is ready", "Open My Pitches to see it.");
    });
    socket.on("notify", ({ items, total }: { items: NotifyItem[]; total: number }) => {
      setUnread((u) => u + total);
      items.slice(0, 2).forEach((n) => pushToast(`@${n.handle} ${n.type === "intent" ? INTENT_VERB[n.segment] : VERB[n.type] ?? n.type}`, n.text));
      if (total > 2) pushToast(`+${total - 2} more reactions`, null);
    });
    const poll = setInterval(() => void refresh(), 20000); // safety net if the socket drops
    return () => {
      clearInterval(poll);
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh]);

  function pushToast(title: string, body: string | null) {
    const id = ++seq.current;
    setToasts((t) => [...t.slice(-3), { id, title, body }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }

  async function join(nickname: string) {
    const res = await fetch(`/api/rooms/${roomId}/join`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ nickname }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Could not join");
    try { localStorage.setItem(storageKey, data.memberId); } catch {}
    setMemberId(data.memberId);
  }

  async function post(text: string) {
    const res = await fetch(`/api/rooms/${roomId}/posts`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ memberId, text }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Could not pitch");
    await refresh();
  }

  return { memberId, view, error, toasts, unread, clearUnread: () => setUnread(0), join, post, refresh };
}
