"use client";
import { useState } from "react";
import Link from "next/link";
import { useRoom } from "@/lib/useRoom";
import Composer from "./Composer";
import Dashboard from "./Dashboard";
import MyPosts from "./MyPosts";
import Thread from "./Thread";

type Tab = "timeline" | "dashboard" | "mine";

const STATUS: Record<string, string> = {
  running: "Agents are scrolling",
  "waiting for posts": "Idle · post to start",
  paused: "Paused",
  "daily cap reached": "Daily limit reached",
  starting: "Starting",
};

export default function RoomApp({ roomId }: { roomId: string }) {
  const r = useRoom(roomId);
  const [tab, setTab] = useState<Tab>("timeline");
  const [nickname, setNickname] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);

  if (r.error) return <main className="p-8 text-center text-muted">{r.error}. <Link className="text-accent hover:underline" href="/">Back</Link></main>;
  if (!r.view) return <main className="p-8 text-center text-muted">Loading…</main>;
  const v = r.view;

  if (!r.memberId || !v.me) {
    return (
      <main className="mx-auto max-w-md px-4 py-16">
        <p className="text-sm text-muted">Room</p>
        <h1 className="mt-1 text-3xl font-extrabold">{v.room.topic}</h1>
        <p className="mt-3 text-muted">You are a campaign manager at our agency. Post your message and see how 1,000 people react in one simulated hour.</p>
        <form
          className="mt-8 space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            try { await r.join(nickname); } catch (err) { setJoinError((err as Error).message); }
          }}
        >
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={24}
            placeholder="Your nickname"
            className="w-full rounded-md border border-line bg-transparent px-3 py-3 outline-none focus:border-accent"
          />
          <button className="w-full rounded-full bg-ink py-3 font-bold text-bg transition hover:opacity-90">Join</button>
        </form>
        {joinError && <p className="mt-2 text-sm text-like">{joinError}</p>}
      </main>
    );
  }

  const tabs: [Tab, string][] = [["timeline", "Timeline"], ["dashboard", "Dashboard"], ["mine", "My Posts"]];

  return (
    <main className="mx-auto min-h-screen max-w-[600px] border-x border-line pb-24">
      <header className="sticky top-0 z-10 border-b border-line bg-bg/80 backdrop-blur-md">
        <div className="px-4 pt-3 pb-1">
          <div className="flex items-center gap-2">
            <Link href="/" className="text-sm font-bold text-accent">Capture the Narrative</Link>
          </div>
          <h1 className="truncate text-xl font-bold">{v.room.topic}</h1>
          <p className="text-[13px] text-muted">
            <span className={`mr-1.5 inline-block h-2 w-2 rounded-full ${v.room.status === "running" ? "animate-pulse bg-repost" : "bg-muted"}`} />
            {STATUS[v.room.status] ?? v.room.status} · @{v.me.handle} · {v.me.followers} followers
          </p>
        </div>
        <nav className="flex">
          {tabs.map(([t, label]) => (
            <button
              key={t}
              onClick={() => { setTab(t); if (t === "mine") r.clearUnread(); }}
              className="relative flex-1 py-4 text-[15px] transition hover:bg-white/5"
            >
              <span className={`relative ${tab === t ? "font-bold text-ink" : "font-medium text-muted"}`}>
                {label}
                {t === "mine" && r.unread > 0 && tab !== "mine" && (
                  <span className="absolute -top-2 -right-5 min-w-5 rounded-full bg-accent px-1.5 text-[11px] font-bold text-white">{r.unread > 99 ? "99+" : r.unread}</span>
                )}
              </span>
              {tab === t && <span className="absolute bottom-0 left-1/2 h-1 w-14 -translate-x-1/2 rounded-full bg-accent" />}
            </button>
          ))}
        </nav>
      </header>

      {tab === "timeline" && (
        <>
          <Composer name={v.me.nickname} onPost={r.post} />
          {v.timeline.map((p) => (
            <Thread key={p.id} roomId={roomId} round={v.room.round} post={p} roundsToFinal={v.room.roundsToFinal} mine={p.authorType === "member" && p.handle === v.me!.handle} />
          ))}
        </>
      )}
      {tab === "dashboard" && <Dashboard view={v} />}
      {tab === "mine" && <MyPosts view={v} />}

      <div className="fixed inset-x-0 bottom-6 z-20 flex flex-col items-center gap-2 px-4">
        {r.toasts.map((t) => (
          <div key={t.id} className="toast-in w-full max-w-sm rounded-md bg-accent px-4 py-3 text-[15px] text-white shadow-lg">
            <div className="font-bold">{t.title}</div>
            {t.body && <div className="mt-0.5 line-clamp-2 text-white/85">{t.body}</div>}
          </div>
        ))}
      </div>
    </main>
  );
}
