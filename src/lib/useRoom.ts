"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type { RoomView } from "@/engine/views";
import { VERB } from "@/components/ui";

export interface Toast {
  id: number;
  title: string;
  body: string | null;
}

interface NotifyItem { type: string; handle: string; role: string; text: string | null }


export function useRoom(roomId: string) {
  // undefined until localStorage has been read, so the first fetch already carries the stored member.
  const [memberId, setMemberId] = useState<string | null | undefined>(undefined);
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
      setMemberId(null); /* storage blocked: user joins again */
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
  // The loop below must use the newest load: if memberId changes mid-fetch, the follow-up fetch has to include it.
  const loadRef = useRef(load);
  loadRef.current = load;
  const refresh = useCallback(async () => {
    if (inFlight.current) {
      again.current = true;
      return;
    }
    inFlight.current = true;
    try {
      do {
        again.current = false;
        await loadRef.current();
      } while (again.current);
    } finally {
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    if (memberId === undefined) return;
    void refresh();
    const socket = io();
    socketRef.current = socket;
    socket.on("connect", () => socket.emit("join", { roomId, memberId }));
    // Spread the room's refetches over half a second instead of all hitting the server at once.
    socket.on("refresh", () => void setTimeout(() => void refresh(), Math.random() * 500));
    socket.on("feedback", () => {
      void refresh();
      pushToast("Your report is ready", "Open My Pitches to see it.");
    });
    socket.on("notify", ({ items, total }: { items: NotifyItem[]; total: number }) => {
      setUnread((u) => u + total);
      items.slice(0, 2).forEach((n) => pushToast(`@${n.handle} ${VERB[n.type] ?? n.type}`, n.text ?? n.role));
      if (total > 2) pushToast(`+${total - 2} more reactions`, null);
    });
    const poll = setInterval(() => void refresh(), 20000); // safety net if the socket drops
    return () => {
      clearInterval(poll);
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh, roomId, memberId]);

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
    if (!res.ok) throw new Error(data.error ?? "Could not post");
    await refresh();
  }

  return { memberId: memberId ?? null, view, error, toasts, unread, clearUnread: () => setUnread(0), join, post, refresh };
}
