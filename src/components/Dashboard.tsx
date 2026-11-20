"use client";
import { useState } from "react";
import type { RoomView } from "@/engine/views";
import { Avatar, Progress, SideBadge, compact } from "./ui";

const ROWS = [
  ["like", "Likes"],
  ["repost", "Reposts"],
  ["reply", "Replies"],
  ["follow", "Follows"],
  ["unfollow", "Unfollows"],
  ["persuasion", "Persuaded"],
  ["backlash", "Backlash"],
  ["neutralShift", "Neutral shift"],
] as const;

export default function Dashboard({ view }: { view: RoomView }) {
  const { leaderboard, room, stats } = view;
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="space-y-4 p-4">
      <div className="grid grid-cols-4 overflow-hidden rounded-2xl border border-line text-center">
        {[
          ["agents", stats.agents],
          ["people", stats.members],
          ["posts", stats.posts],
          ["reactions", stats.reactions],
        ].map(([k, v], i) => (
          <div key={k} className={`py-3 ${i ? "border-l border-line" : ""}`}>
            <div className="text-xl font-extrabold tabular-nums">{compact(Number(v))}</div>
            <div className="text-[13px] text-muted">{k}</div>
          </div>
        ))}
      </div>

      <section className="overflow-hidden rounded-2xl border border-line">
        <h2 className="px-4 pt-3 pb-2 text-xl font-extrabold">Leaderboard</h2>
        {leaderboard.length === 0 && <p className="px-4 pb-6 text-muted">No posts yet</p>}
        <ol>
          {leaderboard.map((p, i) => {
            const expanded = open === p.id;
            const c = p.counts;
            const reactions = c.like + c.repost + c.reply + c.follow + c.unfollow;
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
                      <SideBadge side={p.side} />
                      {!p.finalized && <span className="text-xs font-bold text-repost">● live</span>}
                    </div>
                    <p className={`text-sm ${expanded ? "mt-1 whitespace-pre-wrap break-words text-ink" : "truncate text-muted"}`}>{p.text}</p>
                  </div>
                  <span className="pt-1.5 text-lg font-extrabold tabular-nums">{p.points}</span>
                  <span className={`pt-2 text-muted transition ${expanded ? "rotate-180" : ""}`}>▾</span>
                </button>

                {expanded && (
                  <div className="px-4 pb-4 pl-[4.75rem]">
                    <div className="mb-3 flex flex-wrap items-center gap-4 text-[13px] text-muted">
                      <Progress post={p} roundsToFinal={room.roundsToFinal} />
                      <span>{compact(c.impressions)} views</span>
                      <span>{c.impressions ? ((reactions / c.impressions) * 100).toFixed(1) : "0.0"}% reaction rate</span>
                    </div>
                    <table className="w-full text-sm">
                      <thead className="text-[13px] text-muted">
                        <tr>
                          <th className="text-left font-normal">Engagement</th>
                          <th className="text-right font-normal">Count</th>
                          <th className="text-right font-normal">Points</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ROWS.map(([key, label]) => {
                          const pts = c[key] * room.points[key];
                          return (
                            <tr key={key} className={`border-t border-line ${c[key] ? "" : "text-muted"}`}>
                              <td className="py-1.5">
                                {label} <span className="text-[12px] text-muted">({room.points[key] > 0 ? "+" : ""}{room.points[key]})</span>
                              </td>
                              <td className="text-right tabular-nums">{c[key]}</td>
                              <td className={`text-right font-bold tabular-nums ${pts > 0 ? "text-repost" : pts < 0 ? "text-like" : ""}`}>{pts}</td>
                            </tr>
                          );
                        })}
                        <tr className="border-t border-line font-extrabold">
                          <td className="py-1.5">Total</td>
                          <td />
                          <td className="text-right tabular-nums text-accent">{p.points}</td>
                        </tr>
                      </tbody>
                    </table>
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
