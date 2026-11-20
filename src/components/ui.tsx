import type { PostView } from "@/engine/views";

export const SIDE_STYLE: Record<string, string> = {
  for: "bg-emerald-100 text-emerald-800",
  against: "bg-rose-100 text-rose-800",
  neutral: "bg-slate-200 text-slate-700",
};
export const SIDE_LABEL: Record<string, string> = { for: "For the ban", against: "Against the ban", neutral: "Neutral" };

export function SideBadge({ side }: { side: string }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${SIDE_STYLE[side]}`}>{SIDE_LABEL[side]}</span>;
}

export const simLabel = (rounds: number, perRound = 15) => {
  const m = rounds * perRound;
  return m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ""}` : `${m} min`;
};

export function Progress({ post, roundsToFinal }: { post: PostView; roundsToFinal: number }) {
  const pct = Math.min(100, (post.roundsSeen / roundsToFinal) * 100);
  return (
    <div className="flex items-center gap-2 text-xs text-slate-500">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-200">
        <div className={`h-full ${post.finalized ? "bg-slate-800" : "bg-sky-500"} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      {post.finalized ? "final (1h)" : `${simLabel(post.roundsSeen)} / 1h`}
    </div>
  );
}

export function Counts({ post }: { post: PostView }) {
  const c = post.counts;
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
      <span title="likes">♥ {c.like}</span>
      <span title="reposts">⟲ {c.repost}</span>
      <span title="replies">💬 {c.reply}</span>
      {c.persuasion > 0 && <span className="text-emerald-700" title="persuaded">↗ {c.persuasion}</span>}
      {c.backlash > 0 && <span className="text-rose-700" title="backlash">↘ {c.backlash}</span>}
      <span className="text-slate-400" title="impressions">👁 {c.impressions}</span>
    </div>
  );
}

export function PostCard({ post, roundsToFinal, highlight }: { post: PostView; roundsToFinal: number; highlight?: boolean }) {
  const human = post.authorType === "member";
  return (
    <article className={`rounded-xl border bg-white p-4 shadow-sm ${human ? "border-sky-300" : "border-slate-200"} ${highlight ? "ring-2 ring-amber-300" : ""}`}>
      <header className="mb-1 flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold">{post.name}</span>
        <span className="text-slate-500">@{post.handle}</span>
        {human && <span className="rounded bg-sky-100 px-1.5 text-xs font-medium text-sky-800">human</span>}
        <SideBadge side={post.side} />
      </header>
      <p className="whitespace-pre-wrap break-words">{post.text}</p>
      <footer className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <Counts post={post} />
        {human && (
          <div className="flex items-center gap-3">
            <Progress post={post} roundsToFinal={roundsToFinal} />
            <span className="text-sm font-semibold">{post.points} pts</span>
          </div>
        )}
      </footer>
    </article>
  );
}
