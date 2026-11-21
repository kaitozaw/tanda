"use client";
import { useState } from "react";
import type { RoomView } from "@/engine/views";
import { Avatar, Progress, SIM_LABEL, ScorecardGrid, TYPE_LABEL, compact } from "./ui";

export const EVENT_LABEL: Record<string, string> = {
  like: "Likes",
  repost: "Reposts",
  reply: "Replies",
  follow: "Follows",
  unfollow: "Unfollows",
  intent: "Intent",
  objection: "Objections",
};
const ORDER = Object.keys(EVENT_LABEL);

export default function Dashboard({ view }: { view: RoomView }) {
  const { leaderboard, room, stats, audience } = view;
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="space-y-4 p-4">
      <div className="grid grid-cols-4 overflow-hidden rounded-2xl border border-line text-center">
        {[
          ["agents", stats.agents],
          ["people", stats.members],
          ["pitches", stats.pitches],
          ["reactions", stats.reactions],
        ].map(([k, v], i) => (
          <div key={k} className={`py-3 ${i ? "border-l border-line" : ""}`}>
            <div className="text-xl font-extrabold tabular-nums">{compact(Number(v))}</div>
            <div className="text-[13px] text-muted">{k}</div>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border border-line px-4 py-3">
        <h2 className="text-[15px] font-bold">Audience · {room.market.name}</h2>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {audience.map((a) => (
            <span key={a.type}>
              <span className="font-bold tabular-nums">{a.count}</span> <span className="text-muted">{TYPE_LABEL[a.type]}</span>
            </span>
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-line">
        <h2 className="px-4 pt-3 pb-2 text-xl font-extrabold">Leaderboard</h2>
        {leaderboard.length === 0 && <p className="px-4 pb-6 text-muted">No pitches yet</p>}
        <ol>
          {leaderboard.map((p, i) => {
            const expanded = open === p.id;
            const rows = [...p.breakdown].sort((a, b) => ORDER.indexOf(a.type) - ORDER.indexOf(b.type));
            return (
              <li key={p.id} className="border-t border-line">
                <button
                  onClick={() => setOpen(expanded ? null : p.id)}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-white/[0.03]"
                >
                  <span className={`w-5 pt-2 text-center text-[15px] font-bold ${i === 0 ? "text-accent" : "text-muted"}`}>{i + 1}</span>
                  <Avatar name={p.nickname} me={p.handle === view.me?.handle} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5 text-[15px]">
                      <span className="font-bold">{p.nickname}</span>
                      {!p.finalized && <span className="text-xs font-bold text-repost">● live</span>}
                    </div>
                    <p className={`text-sm ${expanded ? "mt-1 whitespace-pre-wrap break-words text-ink" : "truncate text-muted"}`}>{p.text}</p>
                    {!expanded && (
                      <p className="mt-0.5 text-[12px] text-muted tabular-nums">
                        {p.scorecard.segments.reduce((n, g) => n + g.intent, 0)} intent · {p.scorecard.segments.reduce((n, g) => n + g.objection, 0)} objections
                      </p>
                    )}
                  </div>
                  <span className="pt-1.5 text-lg font-extrabold tabular-nums">{p.points}</span>
                  <span className={`pt-2 text-muted transition ${expanded ? "rotate-180" : ""}`}>▾</span>
                </button>

                {expanded && (
                  <div className="space-y-3 px-4 pb-4 pl-[4.75rem]">
                    <div className="flex flex-wrap items-center gap-4 text-[13px] text-muted">
                      <Progress post={p} roundsToFinal={room.roundsToFinal} />
                      <span>{compact(p.scorecard.views)} views</span>
                    </div>
                    <ScorecardGrid s={p.scorecard} />
                    <table className="w-full text-sm">
                      <thead className="text-[13px] text-muted">
                        <tr>
                          <th className="text-left font-normal">Engagement</th>
                          <th className="text-right font-normal">Count</th>
                          <th className="text-right font-normal">Points</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r) => (
                          <tr key={r.type} className="border-t border-line">
                            <td className="py-1.5">{EVENT_LABEL[r.type] ?? r.type}</td>
                            <td className="text-right tabular-nums">{r.count}</td>
                            <td className={`text-right font-bold tabular-nums ${r.points > 0 ? "text-repost" : r.points < 0 ? "text-like" : ""}`}>{r.points}</td>
                          </tr>
                        ))}
                        <tr className="border-t border-line font-extrabold">
                          <td className="py-1.5">Total</td>
                          <td />
                          <td className="text-right tabular-nums text-accent">{p.points}</td>
                        </tr>
                      </tbody>
                    </table>
                    <p className="text-[12px] text-muted">{SIM_LABEL}</p>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
