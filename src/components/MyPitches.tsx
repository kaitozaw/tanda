"use client";
import type { RoomView } from "@/engine/views";
import { FeedbackCard, INTENT_LABEL, PostCard, ScorecardGrid } from "./ui";

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
              {fb && <FeedbackCard fb={fb} />}

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
