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
  if (me.posts.length === 0) return <p className="px-4 py-10 text-center text-muted">You have not posted yet. Go to Timeline to post.</p>;
  return (
    <div>
      {me.posts.map((p) => (
        <section key={p.id} className="border-b border-line pb-4">
          <PostCard post={p} roundsToFinal={view.room.roundsToFinal} mine />

          <div className="space-y-3 px-4 pt-3">
            {p.feedbackStatus === "pending" && <p className="text-sm text-muted">Writing feedback…</p>}
            {p.feedback && (
              <div className="rounded-2xl border border-accent/40 bg-accent/5 p-4 text-[15px]">
                <h3 className="font-extrabold text-accent">Feedback</h3>
                <p className="mt-1">{p.feedback.verdict}</p>
                <div className="mt-2 flex flex-wrap gap-4 text-[13px] text-muted">
                  <span>Views {p.feedback.stats.views}</span>
                  <span>Reaction rate {(p.feedback.stats.reactionRate * 100).toFixed(1)}%</span>
                </div>
                {p.feedback.whatWorked.length > 0 && (
                  <>
                    <h4 className="mt-3 font-bold">What worked</h4>
                    <ul className="list-disc pl-5 text-ink/90">{p.feedback.whatWorked.map((x) => <li key={x}>{x}</li>)}</ul>
                  </>
                )}
                <h4 className="mt-3 font-bold">Improve</h4>
                <ul className="list-disc pl-5 text-ink/90">{p.feedback.improvements.map((x) => <li key={x}>{x}</li>)}</ul>
                <h4 className="mt-3 font-bold">Try this version</h4>
                <p className="mt-1 rounded-xl border border-line p-3">{p.feedback.rewrite}</p>
                {p.feedback.stats.segments.length > 0 && (
                  <>
                    <h4 className="mt-3 font-bold">By audience</h4>
                    <table className="mt-1 w-full text-left text-[13px]">
                      <thead className="text-muted"><tr><th className="font-normal">Segment</th><th className="font-normal">Reacted</th><th className="font-normal">Persuaded</th><th className="font-normal">Backlash</th></tr></thead>
                      <tbody>
                        {p.feedback.stats.segments.slice(0, 6).map((s) => (
                          <tr key={s.segment} className="border-t border-line"><td className="py-1">{s.segment}</td><td>{s.reacted}</td><td>{s.persuaded}</td><td>{s.backlash}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
              </div>
            )}

            <details className="rounded-2xl border border-line p-3 text-sm" open={!p.finalized}>
              <summary className="cursor-pointer font-bold">Activity ({p.activity.length})</summary>
              <ul className="mt-2 max-h-64 space-y-1.5 overflow-y-auto">
                {p.activity.map((e) => (
                  <li key={e.id}>
                    <span className="font-bold">@{e.handle}</span> <span className="text-muted">· {e.role}</span> {VERB[e.type]}
                    {e.text && <span className="text-ink/90">: “{e.text}”</span>}
                    {e.stanceBefore !== null && <span className="ml-1 tabular-nums text-muted">({e.stanceBefore} → {e.stanceAfter})</span>}
                  </li>
                ))}
              </ul>
            </details>
          </div>
        </section>
      ))}
    </div>
  );
}
