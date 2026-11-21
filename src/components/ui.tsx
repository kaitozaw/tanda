import type { PostView } from "@/engine/views";
import type { Feedback, Scorecard } from "@/engine/types";

export function PitchBadge() {
  return <span className="rounded-full border border-accent/40 px-2 py-px text-xs text-accent">Pitch</span>;
}

export const SEGMENT_LABEL: Record<string, string> = {
  customer: "Customers",
  investor: "Investors",
  industry_lead: "Industry",
  regulator: "Regulators",
  media: "Media",
};

export const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

/** What an intent means per segment, short (PRODUCT.md → Scoring). */
export const INTENT_LABEL: Record<string, string> = {
  customer: "would pay",
  investor: "want a meeting",
  industry_lead: "would partner",
  regulator: "would support",
  media: "would cover",
};

/** A pitch's scorecard: reach, then one row per segment (Dashboard row and My Pitches). */
export function ScorecardGrid({ s }: { s: Scorecard }) {
  const intents = s.segments.reduce((n, g) => n + g.intent, 0);
  const objections = s.segments.reduce((n, g) => n + g.objection, 0);
  return (
    <div className="overflow-hidden rounded-xl border border-line">
      <div className="grid grid-cols-3 text-center">
        {[
          ["Reach", compact(s.reach), `${pct(s.reactionRate)} reacted`],
          ["Intent", String(intents), "people"],
          ["Objections", String(objections), "people"],
        ].map(([label, value, sub], i) => (
          <div key={label} className={`px-1 py-2 ${i ? "border-l border-line" : ""}`}>
            <div className="text-[12px] text-muted">{label}</div>
            <div className="text-lg font-extrabold tabular-nums">{value}</div>
            <div className="text-[11px] leading-tight text-muted">{sub}</div>
          </div>
        ))}
      </div>
      <table className="w-full border-t border-line text-left text-[13px]">
        <thead className="text-muted">
          <tr>
            <th className="py-1 pl-3 font-normal">Segment</th>
            <th className="font-normal">Saw</th>
            <th className="font-normal">Reacted</th>
            <th className="font-normal">Intent</th>
            <th className="pr-3 font-normal">Objection</th>
          </tr>
        </thead>
        <tbody>
          {s.segments.map((g) => (
            <tr key={g.segment} className={`border-t border-line ${g.seen ? "" : "text-muted"}`}>
              <td className="py-1 pl-3">{SEGMENT_LABEL[g.segment]}</td>
              <td className="tabular-nums">{g.seen}</td>
              <td className="tabular-nums">{g.reacted}</td>
              <td className="tabular-nums">
                <span className={g.intent ? "font-bold text-repost" : ""}>{g.intent}</span> <span className="text-[11px] text-muted">{INTENT_LABEL[g.segment]}</span>
              </td>
              <td className={`pr-3 tabular-nums ${g.objection ? "font-bold text-like" : ""}`}>{g.objection}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const SIM_LABEL = "Simulated audience. Use it to decide what to test for real.";

/** A pitch's AI feedback (My Pitches, and any pitch opened from the Dashboard leaderboard). */
export function FeedbackCard({ fb }: { fb: Feedback }) {
  return (
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
  );
}


export const simLabel = (rounds: number, perRound = 15) => {
  const m = rounds * perRound;
  return m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ""}` : `${m}m`;
};

export const compact = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K` : String(n));

// ---- icons (simple line icons, 18px) ----
const Svg = ({ d, className = "" }: { d: string; className?: string }) => (
  <svg viewBox="0 0 24 24" className={`h-[18px] w-[18px] ${className}`} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);
export const IconReply = () => <Svg d="M4 12a8 8 0 0 1 8-8h1a7 7 0 0 1 0 14h-2l-5 3v-4.5A8 8 0 0 1 4 12z" />;
export const IconRepost = () => <Svg d="M7 7h10l-3-3M17 17H7l3 3M17 7v6M7 17v-6" />;
export const IconLike = () => <Svg d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />;
export const IconViews = () => <Svg d="M5 20V10M10 20V4M15 20v-7M20 20v-4" />;

/** `me` adds a blue ring: only the viewer's own avatar has it. */
export function Avatar({ name, me, size = 40 }: { name: string; me?: boolean; size?: number }) {
  // Stable colour per name.
  const hue = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full font-bold text-white ${me ? "ring-2 ring-accent" : ""}`}
      style={{ width: size, height: size, background: `hsl(${hue} 45% 35%)`, fontSize: size * 0.4 }}
    >
      {name.trim().charAt(0).toUpperCase() || "?"}
    </div>
  );
}

export function Progress({ post, roundsToFinal }: { post: PostView; roundsToFinal: number }) {
  const pct = Math.min(100, (post.roundsSeen / roundsToFinal) * 100);
  return (
    <span className="flex items-center gap-2 text-xs text-muted">
      <span className="h-1 w-16 overflow-hidden rounded-full bg-line">
        <span className={`block h-full ${post.finalized ? "bg-ink" : "bg-accent"} transition-all`} style={{ width: `${pct}%` }} />
      </span>
      {post.finalized ? "final · 1h" : `${simLabel(post.roundsSeen)} / 1h`}
    </span>
  );
}

/** X-style action row: replies, reposts, likes, views. Signals are private, so not shown here. */
export function Actions({ post }: { post: PostView }) {
  const c = post.counts;
  const item = (icon: React.ReactNode, n: number, hover: string, title: string) => (
    <span title={title} className={`flex items-center gap-1.5 text-muted transition ${hover}`}>
      {icon}
      <span className="text-[13px] tabular-nums">{n > 0 ? compact(n) : ""}</span>
    </span>
  );
  return (
    <div className="mt-3 flex max-w-md justify-between">
      {item(<IconReply />, c.reply, "hover:text-accent", "replies")}
      {item(<IconRepost />, c.repost, "hover:text-repost", "reposts")}
      {item(<IconLike />, c.like, "hover:text-like", "likes")}
      {item(<IconViews />, c.impressions, "hover:text-accent", "views")}
    </div>
  );
}

export function PostCard({ post, roundsToFinal, mine }: { post: PostView; roundsToFinal: number; mine?: boolean }) {
  const human = post.authorType === "member";
  return (
    <article className={`flex gap-3 border-b border-line px-4 py-3 transition hover:bg-hover`}>
      <Avatar name={post.name} me={mine} />
      <div className="min-w-0 flex-1">
        <header className="flex flex-wrap items-center gap-x-1.5 text-[15px]">
          <span className="font-bold">{post.name}</span>
          {human && (
            <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] text-accent" aria-label="human">
              <path fill="currentColor" d="M12 2l2.4 2.1 3.2-.3.9 3.1 2.8 1.6-1.2 3 1.2 3-2.8 1.6-.9 3.1-3.2-.3L12 22l-2.4-2.1-3.2.3-.9-3.1-2.8-1.6 1.2-3-1.2-3 2.8-1.6.9-3.1 3.2.3z" />
              <path d="M8.5 12.5l2.3 2.2 4.7-5" stroke="#000" strokeWidth={2} fill="none" strokeLinecap="round" />
            </svg>
          )}
          <span className="truncate text-muted">@{post.handle}{post.role ? ` · ${post.role}` : ""}</span>
          {human && <PitchBadge />}
        </header>
        <p className="mt-0.5 whitespace-pre-wrap break-words text-[15px] leading-5">{post.text}</p>
        <Actions post={post} />
        {human && (
          <div className="mt-2 flex items-center justify-between">
            <Progress post={post} roundsToFinal={roundsToFinal} />
            <span className="text-sm font-bold text-accent">{post.points} pts</span>
          </div>
        )}
      </div>
    </article>
  );
}
