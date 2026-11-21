"use client";
import type { RoomView } from "@/engine/views";
import { PostCard, SIM_LABEL, ScoreStats, StakeholderTable, TYPE_LABEL, VERB, tone } from "./ui";

const STAKEHOLDERS = [
  ["customers", "Customers"],
  ["investors", "Investors"],
  ["industry", "Industry"],
  ["regulators", "Regulators"],
  ["media", "Media"],
] as const;

export default function MyPitches({ view }: { view: RoomView }) {
  const me = view.me;
  if (!me) return null;
  if (me.posts.length === 0) return <p className="px-4 py-10 text-center text-muted">You have not pitched yet. Go to Timeline to post a pitch.</p>;
  return (
    <div>
      {me.posts.map((p) => {
        const fb = p.feedback;
        return (
          <section key={p.id} className="border-b border-line pb-4">
            <PostCard post={p} roundsToFinal={view.room.roundsToFinal} mine room={view.room} />

            <div className="space-y-3 px-4 pt-3">
              <ScoreStats s={fb?.scorecard ?? p.scorecard} kind={view.room.kind} />
              <p className="text-[12px] text-muted">{SIM_LABEL}</p>

              {p.feedbackStatus === "pending" && <p className="text-sm text-muted">Writing your report…</p>}
              {fb && (
                <div className="space-y-3 rounded-2xl border border-accent/40 bg-accent/5 p-4 text-[15px]">
                  <div>
                    <h3 className="font-extrabold text-accent">Report</h3>
                    <p className="mt-1">{fb.verdict}</p>
                  </div>

                  {fb.objections.length > 0 && (
                    <div>
                      <h4 className="font-bold">Top objections</h4>
                      <ul className="mt-1 space-y-1">
                        {fb.objections.map((o) => (
                          <li key={o.theme}>
                            <span className="font-bold">{o.theme}</span> <span className="text-muted">×{o.count}</span>
                            <div className="text-[13px] text-ink/80">“{o.quote}”</div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="grid gap-3 sm:grid-cols-2">
                    {([["Champions", fb.champions, "text-repost"], ["Blockers", fb.blockers, "text-like"]] as const).map(([label, people, color]) => (
                      <div key={label}>
                        <h4 className={`font-bold ${color}`}>{label}</h4>
                        {people.length === 0 && <p className="text-[13px] text-muted">None</p>}
                        <ul className="mt-1 space-y-1 text-[13px]">
                          {people.map((x) => (
                            <li key={x.handle + x.said}><span className="font-bold">@{x.handle}</span> <span className="text-muted">· {x.role}</span><div className="text-ink/80">{x.said}</div></li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>

                  <div>
                    <h4 className="font-bold">By stakeholder</h4>
                    <ul className="mt-1 space-y-1 text-[13px]">
                      {STAKEHOLDERS.map(([k, label]) => <li key={k}><span className="font-bold">{label}:</span> {fb.byStakeholder[k]}</li>)}
                    </ul>
                    <div className="mt-2"><StakeholderTable s={fb.scorecard} /></div>
                  </div>

                  <div>
                    <h4 className="font-bold">Try this pitch next</h4>
                    <p className="mt-1 rounded-xl border border-line p-3">{fb.rewrite}</p>
                  </div>
                  <div>
                    <h4 className="font-bold">Real-world next step</h4>
                    <p className="mt-1">{fb.nextStep}</p>
                  </div>
                </div>
              )}

              <details className="rounded-2xl border border-line p-3 text-sm" open={!p.finalized}>
                <summary className="cursor-pointer font-bold">Activity ({p.activity.length})</summary>
                <ul className="mt-2 max-h-64 space-y-1.5 overflow-y-auto">
                  {p.activity.map((e) => (
                    <li key={e.id}>
                      <span className="font-bold">@{e.handle}</span> <span className="text-muted">· {TYPE_LABEL[e.agentType]} · {e.role}</span>{" "}
                      <span className={tone(e.type)}>{VERB[e.type] ?? e.type}</span>
                      {e.text && <span className="text-ink/90">: “{e.text}”</span>}
                      {e.stanceBefore !== null && <span className="ml-1 tabular-nums text-muted">({e.stanceBefore} → {e.stanceAfter})</span>}
                    </li>
                  ))}
                </ul>
              </details>
            </div>
          </section>
        );
      })}
    </div>
  );
}
