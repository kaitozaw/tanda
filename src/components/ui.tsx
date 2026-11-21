import type { PostView, RoomView } from "@/engine/views";
import type { AgentType, Scorecard } from "@/engine/types";

export const TYPE_LABEL: Record<AgentType, string> = {
  customer: "Customers",
  investor: "Investors",
  industry_lead: "Industry",
  regulator: "Regulators",
  media: "Media",
};
export const KIND_LABEL: Record<string, string> = { product: "Product", feature: "Feature", decision: "Decision" };

/** Past-tense verb for the activity log and notifications. */
export const VERB: Record<string, string> = {
  like: "liked",
  repost: "reposted",
  reply: "replied",
  follow: "followed you",
  unfollow: "unfollowed you",
  would_try: "would try it",
  would_pay: "would pay for it",
  want_meeting: "wants a meeting",
  pass: "passed",
  partner: "wants to partner",
  compete: "sees a competitor",
  support: "supports it",
  concern: "raised a concern",
  would_cover: "would cover it",
  objection: "objected",
  persuasion: "was persuaded",
  backlash: "was put off",
};
const POSITIVE = new Set(["would_try", "would_pay", "want_meeting", "partner", "support", "would_cover", "persuasion"]);
const NEGATIVE = new Set(["pass", "concern", "objection", "backlash", "unfollow"]);
export const tone = (type: string) => (POSITIVE.has(type) ? "text-repost" : NEGATIVE.has(type) ? "text-like" : "text-ink");

export const SIM_LABEL = "Simulated audience. Use it to decide what to test for real.";

export const simLabel = (rounds: number, perRound = 15) => {
  const m = rounds * perRound;
  return m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ""}` : `${m}m`;
};

export const compact = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K` : String(n));

// ---- icons (simple line icons, 18px) ----
const Svg = ({ d, className = "h-[18px] w-[18px]" }: { d: string; className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);
export const IconReply = () => <Svg d="M4 12a8 8 0 0 1 8-8h1a7 7 0 0 1 0 14h-2l-5 3v-4.5A8 8 0 0 1 4 12z" />;
export const IconRepost = () => <Svg d="M7 7h10l-3-3M17 17H7l3 3M17 7v6M7 17v-6" />;
export const IconLike = () => <Svg d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />;
export const IconViews = () => <Svg d="M5 20V10M10 20V4M15 20v-7M20 20v-4" />;
export const IconPersuade = () => <Svg d="M7 17L17 7M9 7h8v8" />;
// Tab-bar icons (bottom nav on phones), 24px.
export const IconHome = ({ className = "h-6 w-6" }: { className?: string }) => <Svg className={className} d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />;
export const IconChart = ({ className = "h-6 w-6" }: { className?: string }) => <Svg className={className} d="M5 20V10M10 20V4M15 20v-7M20 20v-4" />;
export const IconUser = ({ className = "h-6 w-6" }: { className?: string }) => <Svg className={className} d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0" />;

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

/** X-style action row: replies, reposts, likes, persuaded, views. */
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
      {post.isPitch && item(<IconPersuade />, c.persuasion, "hover:text-repost", "persuaded")}
      {item(<IconViews />, c.impressions, "hover:text-accent", "views")}
    </div>
  );
}

type Room = RoomView["room"];

/** The idea under test. `compact` is the link-preview version attached to pitches. */
export function IdeaCard({ room, compact: small }: { room: Pick<Room, "title" | "kind" | "description" | "region">; compact?: boolean }) {
  if (small) {
    return (
      <div className="mt-2 overflow-hidden rounded-2xl border border-line">
        <div className="px-3 py-2">
          <div className="text-[13px] text-muted">{KIND_LABEL[room.kind]} · {room.region}</div>
          <div className="truncate text-[15px] font-bold">{room.title}</div>
        </div>
      </div>
    );
  }
  return (
    <section className="border-b border-line px-4 py-4">
      <div className="text-[13px] font-bold uppercase tracking-wide text-accent">{KIND_LABEL[room.kind]} under test · {room.region}</div>
      <h2 className="mt-1 text-xl font-extrabold">{room.title}</h2>
      <p className="mt-1 whitespace-pre-wrap text-[15px] text-ink/90">{room.description}</p>
    </section>
  );
}

const STEPS = [
  ["plan", "Planning who is in your market"],
  ["agents", "Creating the audience"],
  ["bios", "Giving everyone a voice"],
] as const;

/** Agents per stakeholder type and segment. While building, also shows the build steps. */
export function AudiencePanel({ view }: { view: RoomView }) {
  const { room, audience } = view;
  const building = room.buildStatus === "generating";
  const stepIndex = STEPS.findIndex(([s]) => s === room.step);
  return (
    <section className="overflow-hidden rounded-2xl border border-line">
      <h2 className="px-4 pt-3 text-xl font-extrabold">Audience</h2>
      {building && (
        <ol className="space-y-1 px-4 pt-2 text-sm">
          {STEPS.map(([s, label], i) => (
            <li key={s} className={i < stepIndex ? "text-repost" : i === stepIndex ? "font-bold text-ink" : "text-muted"}>
              {i < stepIndex ? "✓" : i === stepIndex ? <span className="inline-block animate-pulse">●</span> : "○"} {label}
            </li>
          ))}
        </ol>
      )}
      {room.buildStatus === "error" && <p className="px-4 pt-2 text-sm text-like">Building the audience failed. Ask an organiser to reset the room.</p>}
      {audience.length === 0 ? (
        <p className="px-4 py-4 text-sm text-muted">Reading your idea…</p>
      ) : (
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          {audience.map((t) => (
            <div key={t.type} className={t.type === "customer" ? "sm:col-span-2" : ""}>
              <div className="flex items-baseline justify-between">
                <span className="font-bold">{TYPE_LABEL[t.type]}</span>
                <span className="tabular-nums text-muted">{t.count}</span>
              </div>
              <ul className="mt-1 space-y-0.5 text-[13px]">
                {t.segments.map((s) => (
                  <li key={s.name} className="flex justify-between gap-2">
                    <span className="truncate text-ink/90">
                      {s.name}
                      {s.kind === "sceptic" && <span className="ml-1 text-like">· sceptics</span>}
                      {s.kind === "adjacent" && <span className="ml-1 text-muted">· adjacent</span>}
                    </span>
                    <span className="tabular-nums text-muted">{s.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

const pctLabel = (p: { yes: number; seen: number; pct: number }) => (p.seen ? `${p.pct}%` : "–");

/** Headline scorecard numbers, one row (leaderboard) or grid (detail). */
export function ScoreStats({ s, kind }: { s: Scorecard; kind: string }) {
  const decision = kind === "decision";
  const cells: [string, string, string?][] = [
    ["Reach", compact(s.reach.unique), `${s.reach.viaRepostPct}% via reposts`],
    [decision ? "Would back it" : "Demand", pctLabel(s.demand), `${s.demand.yes}/${s.demand.seen} target customers`],
    [decision ? "Would act" : "Would pay", pctLabel(s.pay), `${s.pay.yes}/${s.pay.seen} customers`],
    ["Investors", `${s.investors.meeting}/${s.investors.pass}`, "meetings / passes"],
    ["Industry", `${s.industry.partner}/${s.industry.compete}`, "partner / compete"],
    ["Risk flags", String(s.risk.concerns), "regulator concerns"],
  ];
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl sm:grid-cols-3 border border-line bg-line text-center">
      {cells.map(([label, value, sub]) => (
        <div key={label} className="bg-bg px-2 py-2">
          <div className={`text-lg font-extrabold tabular-nums ${label === "Risk flags" && s.risk.concerns ? "text-like" : ""}`}>{value}</div>
          <div className="text-[12px] font-bold">{label}</div>
          {sub && <div className="text-[11px] text-muted">{sub}</div>}
        </div>
      ))}
    </div>
  );
}

/** Seen / positive / negative / support shift per stakeholder type. */
export function StakeholderTable({ s }: { s: Scorecard }) {
  return (
    <div className="overflow-x-auto">
    <table className="w-full text-left text-[13px] whitespace-nowrap [&_td+td]:pl-2 [&_th+th]:pl-2">
      <thead className="text-muted">
        {/* Short headers on phones so all five columns fit at 320px. */}
        <tr>
          <th className="font-normal">Stakeholder</th>
          <th className="text-right font-normal"><span className="sm:hidden">Saw</span><span className="hidden sm:inline">Saw it</span></th>
          <th className="text-right font-normal"><span className="sm:hidden">Pos</span><span className="hidden sm:inline">Positive</span></th>
          <th className="text-right font-normal"><span className="sm:hidden">Neg</span><span className="hidden sm:inline">Negative</span></th>
          <th className="text-right font-normal"><span className="sm:hidden">Shift</span><span className="hidden sm:inline">Support</span></th>
        </tr>
      </thead>
      <tbody>
        {s.stakeholders.map((r) => (
          <tr key={r.type} className="border-t border-line">
            <td className="py-1">{TYPE_LABEL[r.type]}</td>
            <td className="text-right tabular-nums">{r.seen}</td>
            <td className="text-right tabular-nums text-repost">{r.positive || ""}</td>
            <td className="text-right tabular-nums text-like">{r.negative || ""}</td>
            <td className={`text-right tabular-nums ${r.avgShift > 0 ? "text-repost" : r.avgShift < 0 ? "text-like" : "text-muted"}`}>
              {r.avgShift > 0 ? "+" : ""}{r.avgShift}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  );
}

export function PostCard({ post, roundsToFinal, mine, room }: { post: PostView; roundsToFinal: number; mine?: boolean; room?: Room }) {
  return (
    <article className="flex gap-3 border-b border-line px-4 py-3 transition hover:bg-hover">
      <Avatar name={post.name} me={mine} />
      <div className="min-w-0 flex-1">
        <header className="flex flex-wrap items-center gap-x-1.5 text-[15px]">
          <span className="font-bold">{post.name}</span>
          {post.isPitch && <span className="rounded-full border border-accent/40 px-2 py-px text-xs text-accent">Pitch</span>}
          <span className="truncate text-muted">@{post.handle}</span>
          {post.role && <span className="truncate text-[13px] text-muted">· {post.role}</span>}
        </header>
        <p className="mt-0.5 whitespace-pre-wrap break-words text-[15px] leading-5">{post.text}</p>
        {post.isPitch && room && <IdeaCard room={room} compact />}
        <Actions post={post} />
        {post.isPitch && (
          <div className="mt-2 flex items-center justify-between">
            <Progress post={post} roundsToFinal={roundsToFinal} />
            <span className="text-sm font-bold text-accent">{post.points} pts</span>
          </div>
        )}
      </div>
    </article>
  );
}
