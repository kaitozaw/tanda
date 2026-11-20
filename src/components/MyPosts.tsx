"use client";
import type { RoomView } from "@/engine/views";
import { PostCard } from "./ui";

const VERB: Record<string, string> = {
  like: "liked",
  repost: "reposted",
  reply: "replied",
  follow: "followed you",
  unfollow: "unfollowed you",
  persuasion: "was persuaded",
  backlash: "pushed back",
  neutralShift: "rethought their view",
};

export default function MyPosts({ view }: { view: RoomView }) {
  const me = view.me;
  if (!me) return null;
  if (me.posts.length === 0) return <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-slate-400">You have not posted yet. Go to Timeline to post.</p>;
  return (
    <div className="space-y-6">
      {me.posts.map((p) => (
        <section key={p.id} className="space-y-2">
          <PostCard post={p} roundsToFinal={view.room.roundsToFinal} />

          {p.feedbackStatus === "pending" && <p className="text-sm text-slate-500">Writing feedback…</p>}
          {p.feedback && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
              <h3 className="mb-1 font-semibold">Feedback</h3>
              <p>{p.feedback.verdict}</p>
              <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-600">
                <span>Reach {p.feedback.stats.reach}</span>
                <span>Engagement {(p.feedback.stats.engagementRate * 100).toFixed(1)}%</span>
                <span>Backlash risk {p.feedback.stats.backlashRisk}</span>
              </div>
              {p.feedback.whatWorked.length > 0 && (
                <>
                  <h4 className="mt-3 font-medium">What worked</h4>
                  <ul className="list-disc pl-5">{p.feedback.whatWorked.map((x) => <li key={x}>{x}</li>)}</ul>
                </>
              )}
              <h4 className="mt-3 font-medium">Improve</h4>
              <ul className="list-disc pl-5">{p.feedback.improvements.map((x) => <li key={x}>{x}</li>)}</ul>
              <h4 className="mt-3 font-medium">Try this version</h4>
              <p className="rounded-lg bg-white p-3 italic">{p.feedback.rewrite}</p>
              {p.feedback.stats.segments.length > 0 && (
                <>
                  <h4 className="mt-3 font-medium">By audience</h4>
                  <table className="w-full text-left text-xs">
                    <thead className="text-slate-500"><tr><th>Segment</th><th>Engaged</th><th>Persuaded</th><th>Backlash</th></tr></thead>
                    <tbody>
                      {p.feedback.stats.segments.slice(0, 6).map((s) => (
                        <tr key={s.segment}><td>{s.segment}</td><td>{s.engaged}</td><td>{s.persuaded}</td><td>{s.backlash}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          )}

          <details className="rounded-xl border border-slate-200 bg-white p-3 text-sm" open={!p.finalized}>
            <summary className="cursor-pointer font-medium">Activity ({p.activity.length})</summary>
            <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto">
              {p.activity.map((e) => (
                <li key={e.id}>
                  <span className="font-medium">@{e.handle}</span> <span className="text-xs text-slate-400">{e.role}</span> {VERB[e.type]}
                  {e.text && <span className="text-slate-700">: “{e.text}”</span>}
                  {e.stanceBefore !== null && <span className="ml-1 tabular-nums text-slate-500">({e.stanceBefore} → {e.stanceAfter})</span>}
                </li>
              ))}
            </ul>
          </details>
        </section>
      ))}
    </div>
  );
}
