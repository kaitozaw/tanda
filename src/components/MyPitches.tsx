"use client";
import type { RoomView } from "@/engine/views";
import { INTENT_LABEL, PostCard, SIM_LABEL, ScorecardGrid } from "./ui";

const VERB: Record<string, string> = {
  like: "liked",
  repost: "reposted",
  reply: "replied",
  follow: "followed you",
  unfollow: "unfollowed you",
  objection: "objected",
};

export default function MyPitches({ view }: { view: RoomView }) {
  const me = view.me;
  if (!me) return null;
  if (me.posts.length === 0) return <p className="px-4 py-10 text-center text-muted">You have not pitched yet. Go to Timeline to pitch.</p>;
  return (
    <div>
      {me.posts.map((p) => {
        const fb = p.feedback;
        return (
          <section key={p.id} className="border-b border-line pb-4">
            <PostCard post={p} roundsToFinal={view.room.roundsToFinal} mine />

            <div className="space-y-3 px-4 pt-3">
              <ScorecardGrid s={p.scorecard} />

              {p.feedbackStatus === "pending" && <p className="text-sm text-muted">Writing feedback…</p>}
              {fb && (
                <div className="rounded-2xl border border-accent/40 bg-accent/5 p-4 text-[15px]">
                  <h3 className="font-extrabold text-accent">Feedback</h3>
                  <p className="mt-1">{fb.verdict}</p>
                  {fb.landedWith.length > 0 && (
                    <>
                      <h4 className="mt-3 font-bold">Who it landed with</h4>
                      <ul className="list-disc pl-5 text-ink/90">{fb.landedWith.map((x) => <li key={x}>{x}</li>)}</ul>
                    </>
                  )}
                  {fb.objections.length > 0 && (
                    <>
                      <h4 className="mt-3 font-bold">Top objections</h4>
                      <ul className="space-y-1 pl-5 text-ink/90">
                        {fb.objections.map((o) => <li key={o.theme + o.quote} className="list-disc"><span className="font-bold">{o.theme}</span>: “{o.quote}”</li>)}
                      </ul>
                    </>
                  )}
                  <h4 className="mt-3 font-bold">Improve</h4>
                  <ul className="list-disc pl-5 text-ink/90">{fb.improvements.map((x) => <li key={x}>{x}</li>)}</ul>
                  <h4 className="mt-3 font-bold">Try this pitch</h4>
                  <p className="mt-1 rounded-xl border border-line p-3">{fb.rewrite}</p>
                  <h4 className="mt-3 font-bold">Next step in the real world</h4>
                  <p className="mt-1">{fb.nextStep}</p>
                  <p className="mt-3 text-[12px] text-muted">{SIM_LABEL}</p>
                </div>
              )}

              <details className="rounded-2xl border border-line p-3 text-sm" open={!p.finalized}>
                <summary className="cursor-pointer font-bold">Activity ({p.activity.length})</summary>
                <ul className="mt-2 max-h-64 space-y-1.5 overflow-y-auto">
                  {p.activity.map((e) => (
                    <li key={e.id}>
                      <span className="font-bold">@{e.handle}</span> <span className="text-muted">· {e.role}</span>{" "}
                      <span className={e.type === "intent" ? "font-bold text-repost" : e.type === "objection" ? "font-bold text-like" : ""}>
                        {e.type === "intent" ? INTENT_LABEL[e.segment] : VERB[e.type] ?? e.type}
                      </span>
                      {e.text && <span className="text-ink/90">: “{e.text}”</span>}
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
