"use client";
import { useState } from "react";
import Link from "next/link";
import { useRoom } from "@/lib/useRoom";
import Composer from "./Composer";
import Dashboard from "./Dashboard";
import MyPosts from "./MyPosts";
import { PostCard, simLabel } from "./ui";

type Tab = "timeline" | "dashboard" | "mine";

const STATUS: Record<string, string> = {
  running: "Agents are scrolling",
  "waiting for posts": "Idle: post to start the simulation",
  paused: "Paused",
  "daily cap reached": "Daily limit reached",
  starting: "Starting",
};

export default function RoomApp({ roomId }: { roomId: string }) {
  const r = useRoom(roomId);
  const [tab, setTab] = useState<Tab>("timeline");
  const [nickname, setNickname] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);

  if (r.error) return <main className="p-8 text-center text-slate-500">{r.error}. <Link className="underline" href="/">Back</Link></main>;
  if (!r.view) return <main className="p-8 text-center text-slate-400">Loading…</main>;
  const v = r.view;

  if (!r.memberId || !v.me) {
    return (
      <main className="mx-auto max-w-md px-4 py-12">
        <p className="text-sm text-slate-500">Room</p>
        <h1 className="text-2xl font-bold">{v.room.topic}</h1>
        <p className="mt-2 text-slate-600">You are a campaign manager at our agency. Post your message and see how 1,000 people react in one simulated hour.</p>
        <form
          className="mt-6 flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            try { await r.join(nickname); } catch (err) { setJoinError((err as Error).message); }
          }}
        >
          <input value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={24} placeholder="Your nickname" className="flex-1 rounded-full border border-slate-300 px-4 py-2 outline-none focus:border-slate-500" />
          <button className="rounded-full bg-slate-900 px-5 py-2 font-semibold text-white">Join</button>
        </form>
        {joinError && <p className="mt-2 text-sm text-rose-600">{joinError}</p>}
      </main>
    );
  }

  const tabs: [Tab, string][] = [["timeline", "Timeline"], ["dashboard", "Dashboard"], ["mine", "My Posts"]];

  return (
    <main className={`mx-auto px-4 pb-24 ${tab === "dashboard" ? "max-w-6xl" : "max-w-2xl"}`}>
      <header className="sticky top-0 z-10 -mx-4 border-b border-slate-200 bg-[#f5f6f8]/95 px-4 pt-3 backdrop-blur">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="truncate font-bold">{v.room.topic}</h1>
            <p className="text-xs text-slate-500">
              <span className={`mr-1 inline-block h-2 w-2 rounded-full ${v.room.status === "running" ? "animate-pulse bg-emerald-500" : "bg-slate-400"}`} />
              {STATUS[v.room.status] ?? v.room.status} · simulated time {simLabel(v.room.round)} · @{v.me.handle} ({v.me.followers} followers)
            </p>
          </div>
        </div>
        <nav className="mt-2 flex gap-1">
          {tabs.map(([t, label]) => (
            <button
              key={t}
              onClick={() => { setTab(t); if (t === "mine") r.clearUnread(); }}
              className={`relative rounded-t-lg px-4 py-2 text-sm font-medium ${tab === t ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
            >
              {label}
              {t === "mine" && r.unread > 0 && tab !== "mine" && (
                <span className="absolute -top-1 -right-1 rounded-full bg-rose-500 px-1.5 text-xs text-white">{r.unread > 99 ? "99+" : r.unread}</span>
              )}
            </button>
          ))}
        </nav>
      </header>

      <div className="mt-4 space-y-3">
        {tab === "timeline" && (
          <>
            <Composer cooldownMs={v.me.cooldownMs} onPost={r.post} />
            {v.timeline.map((p) => <PostCard key={p.id} post={p} roundsToFinal={v.room.roundsToFinal} />)}
          </>
        )}
        {tab === "dashboard" && <Dashboard view={v} />}
        {tab === "mine" && <MyPosts view={v} />}
      </div>

      <div className="fixed inset-x-0 bottom-4 z-20 flex flex-col items-center gap-2 px-4">
        {r.toasts.map((t) => (
          <div key={t.id} className="toast-in w-full max-w-sm rounded-xl bg-slate-900 px-4 py-3 text-sm text-white shadow-lg">
            <div className="font-medium">{t.title}</div>
            {t.body && <div className="mt-0.5 line-clamp-2 text-slate-300">{t.body}</div>}
          </div>
        ))}
      </div>
    </main>
  );
}
