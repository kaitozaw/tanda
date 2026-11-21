"use client";
import { useState } from "react";
import type { EventType } from "@/engine/types";
import type { RoomView } from "@/engine/views";
import { AudiencePanel, Avatar, Progress, SIM_LABEL, ScoreStats, StakeholderTable, VERB, compact } from "./ui";

const ROWS: EventType[] = [
  "like", "repost", "reply", "follow", "unfollow",
  "would_try", "would_pay", "want_meeting", "pass", "partner", "compete", "support", "concern", "would_cover", "objection",
  "persuasion", "backlash",
];

export default function Dashboard({ view }: { view: RoomView }) {
  const { leaderboard, room, stats } = view;
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="space-y-4 p-3 sm:p-4">
      <div className="grid grid-cols-5 overflow-hidden rounded-2xl border border-line text-center">
        {[
          ["agents", stats.agents],
          ["people", stats.members],
          ["pitches", stats.pitches],
          ["reactions", stats.reactions],
          ["signals", stats.signals],
        ].map(([k, v], i) => (
          <div key={k} className={`min-w-0 py-2.5 sm:py-3 ${i ? "border-l border-line" : ""}`}>
            <div className="text-base font-extrabold tabular-nums sm:text-xl">{compact(Number(v))}</div>
            <div className="truncate text-[11px] text-muted sm:text-[13px]">{k}</div>
          </div>
        ))}
      </div>

      <section className="overflow-hidden rounded-2xl border border-line">
        <h2 className="px-4 pt-3 text-xl font-extrabold">Pitch leaderboard</h2>
        <p className="px-4 pb-2 text-[13px] text-muted">{SIM_LABEL}</p>
        {leaderboard.length === 0 && <p className="px-4 pb-6 text-muted">No pitches yet</p>}
        <ol>
          {leaderboard.map((p, i) => {
            const expanded = open === p.id;
            const s = p.scorecard;
            const decision = room.kind === "decision";
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
                    {/* Scorecard columns: the A/B view */}
                    <div className="mt-1 flex flex-wrap gap-x-3 text-[12px] tabular-nums text-muted">
                      <span>{decision ? "back" : "demand"} <b className="text-ink">{s.demand.seen ? `${s.demand.pct}%` : "–"}</b></span>
                      <span>{decision ? "act" : "pay"} <b className="text-ink">{s.pay.seen ? `${s.pay.pct}%` : "–"}</b></span>
                      <span>meetings <b className="text-ink">{s.investors.meeting}</b></span>
                      <span>risk <b className={s.risk.concerns ? "text-like" : "text-ink"}>{s.risk.concerns}</b></span>
                    </div>
                  </div>
                  <span className="pt-1.5 text-lg font-extrabold tabular-nums">{p.points}</span>
                  <span className={`pt-2 text-muted transition ${expanded ? "rotate-180" : ""}`}>▾</span>
                </button>

                {expanded && (
                  <div className="space-y-4 px-4 pb-4 sm:pl-[4.75rem]">
                    <div className="flex flex-wrap items-center gap-4 text-[13px] text-muted">
                      <Progress post={p} roundsToFinal={room.roundsToFinal} />
                      <span>{compact(p.counts.impressions)} views</span>
                    </div>
                    <ScoreStats s={s} kind={room.kind} />
                    <StakeholderTable s={s} />
                    {s.objections.length > 0 && (
                      <div>
                        <h3 className="text-sm font-bold">Objections</h3>
                        <ul className="mt-1 space-y-1 text-[13px]">
                          {s.objections.slice(0, 5).map((o, k) => (
                            <li key={k}><span className="font-bold">@{o.handle}</span> <span className="text-ink/90">“{o.reason}”</span></li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <table className="w-full text-sm">
                      <thead className="text-[13px] text-muted">
                        <tr>
                          <th className="text-left font-normal">Event</th>
                          <th className="text-right font-normal">Count</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ROWS.filter((k) => p.counts[k] > 0).map((k) => (
                          <tr key={k} className="border-t border-line">
                            <td className="py-1.5">{VERB[k]}</td>
                            <td className="text-right tabular-nums">{p.counts[k]}</td>
                          </tr>
                        ))}
                        <tr className="border-t border-line font-extrabold">
                          <td className="py-1.5">Points</td>
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

      <AudiencePanel view={view} />
    </div>
  );
}
