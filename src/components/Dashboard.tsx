"use client";
import type { RoomView } from "@/engine/views";
import SpreadGraph from "./SpreadGraph";
import { Counts, PostCard, SideBadge } from "./ui";

export default function Dashboard({ view }: { view: RoomView }) {
  const { leaderboard, top, room, stats } = view;
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Leaderboard (human posts)</h2>
        {leaderboard.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-slate-400">No posts yet</p>
        ) : (
          <ol className="space-y-2">
            {leaderboard.map((p, i) => (
              <li key={p.id} className={`flex items-start gap-3 rounded-xl border bg-white p-3 shadow-sm ${i === 0 ? "border-amber-300" : "border-slate-200"}`}>
                <span className={`w-6 text-center text-lg font-bold ${i === 0 ? "text-amber-500" : "text-slate-400"}`}>{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-semibold">{p.nickname}</span>
                    <SideBadge side={p.side} />
                    {!p.finalized && <span className="text-xs text-sky-600">live</span>}
                  </div>
                  <p className="truncate text-sm text-slate-600">{p.text}</p>
                  <Counts post={p} />
                </div>
                <span className="text-lg font-bold tabular-nums">{p.points}</span>
              </li>
            ))}
          </ol>
        )}
        <div className="mt-4 grid grid-cols-4 gap-2 text-center">
          {[
            ["agents", stats.agents],
            ["people", stats.members],
            ["posts", stats.posts],
            ["reactions", stats.events],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg bg-white p-2 shadow-sm">
              <div className="text-lg font-bold tabular-nums">{v}</div>
              <div className="text-xs text-slate-500">{k}</div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Most viral post</h2>
        {top ? (
          <div className="space-y-3">
            <PostCard post={top.post} roundsToFinal={room.roundsToFinal} highlight />
            <SpreadGraph roomId={room.id} postId={top.post.id} version={room.round} />
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <h3 className="mb-2 text-sm font-semibold">Top replies</h3>
                {top.replies.length === 0 && <p className="text-sm text-slate-400">None yet</p>}
                <ul className="space-y-2">
                  {top.replies.map((r) => (
                    <li key={r.id} className="text-sm">
                      <span className="font-medium">@{r.handle}</span> <span className="text-xs text-slate-400">{r.role}</span>
                      <p className="text-slate-700">{r.text}</p>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <h3 className="mb-2 text-sm font-semibold">Changed their mind</h3>
                {top.persuaded.length === 0 && <p className="text-sm text-slate-400">Nobody yet</p>}
                <ul className="space-y-1">
                  {top.persuaded.map((e) => (
                    <li key={e.id} className="text-sm">
                      <span className="font-medium">@{e.handle}</span> <span className="text-xs text-slate-400">{e.role}</span>
                      <span className="ml-1 tabular-nums text-emerald-700">{e.stanceBefore} → {e.stanceAfter}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-slate-400">Waiting for the first post</p>
        )}
      </section>
    </div>
  );
}
