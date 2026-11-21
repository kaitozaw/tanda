"use client";
import { useState } from "react";
import Link from "next/link";
import { useRoom } from "@/lib/useRoom";
import Composer from "./Composer";
import Dashboard from "./Dashboard";
import MyPitches from "./MyPitches";
import Thread from "./Thread";
import { AudiencePanel, IdeaCard, KIND_LABEL } from "./ui";

type Tab = "timeline" | "dashboard" | "mine";

const STATUS: Record<string, string> = {
  running: "Agents are scrolling",
  queued: "Queued · other rooms are running",
  "waiting for pitches": "Idle · pitch to start",
  "building audience": "Building your audience",
  "audience failed": "Audience build failed",
  paused: "Paused",
  "daily cap reached": "Daily limit reached",
};

export default function RoomApp({ roomId }: { roomId: string }) {
  const r = useRoom(roomId);
  const [tab, setTab] = useState<Tab>("timeline");
  const [nickname, setNickname] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);

  if (r.error) return <main className="p-8 text-center text-muted">{r.error}. <Link className="text-accent hover:underline" href="/">Back</Link></main>;
  if (!r.view) return <main className="p-8 text-center text-muted">Loading…</main>;
  const v = r.view;
  const building = v.room.buildStatus !== "ready";

  if (!r.memberId || !v.me) {
    return (
      <main className="mx-auto max-w-md px-4 py-16">
        <p className="text-sm text-muted">{KIND_LABEL[v.room.kind]} under test · {v.room.region}</p>
        <h1 className="mt-1 text-3xl font-extrabold">{v.room.title}</h1>
        <p className="mt-3 whitespace-pre-wrap text-ink/90">{v.room.description}</p>
        <p className="mt-4 text-muted">
          Pitch this {v.room.kind === "decision" ? "decision" : "idea"} to {v.stats.agents.toLocaleString()} AI customers, investors, industry leads, regulators and media. See one simulated hour of reactions in one minute.
        </p>
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

  const tabs: [Tab, string][] = [["timeline", "Timeline"], ["dashboard", "Dashboard"], ["mine", "My Pitches"]];

  return (
    <main className="mx-auto min-h-screen max-w-[600px] border-x border-line pb-24">
      <header className="sticky top-0 z-10 border-b border-line bg-bg/80 backdrop-blur-md">
        <div className="px-4 pt-3 pb-1">
          <Link href="/" className="text-sm font-bold text-accent">Capture the Narrative</Link>
          <h1 className="truncate text-xl font-bold">{v.room.title}</h1>
          <p className="text-[13px] text-muted">
            <span className={`mr-1.5 inline-block h-2 w-2 rounded-full ${v.room.status === "running" || building ? "animate-pulse bg-repost" : "bg-muted"}`} />
            {STATUS[v.room.status] ?? v.room.status} · @{v.me.handle}{v.me.followers ? ` · ${v.me.followers} followers` : ""}
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
          <IdeaCard room={v.room} />
          {building && <div className="border-b border-line p-4"><AudiencePanel view={v} /></div>}
          <Composer name={v.me.nickname} disabled={building ? "Pitching opens once your audience is ready…" : null} onPost={r.post} />
          {v.timeline.map((p) => (
            <Thread key={p.id} roomId={roomId} round={v.room.round} post={p} room={v.room} mine={p.isPitch && p.handle === v.me!.handle} />
          ))}
        </>
      )}
      {tab === "dashboard" && <Dashboard view={v} />}
      {tab === "mine" && <MyPitches view={v} />}

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
