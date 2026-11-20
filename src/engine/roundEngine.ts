import type { Agent, FeedItem } from "./types";
import type { Store } from "./store";
import { config, rules } from "./config";
import { buildFeed, prepare } from "./feedBuilder";
import { runSessions, type SessionInput } from "./sessionRunner";
import { applyResults, finalizeRound } from "./applyEvents";
import { FeedbackWorker } from "./feedback";
import { broadcastRefresh, notifyFeedback, notifyMembers } from "./broadcaster";

export interface RoundSummary {
  round: number;
  sessions: number;
  ok: number;
  failed: number;
  rateLimited: number;
  timedOut: number;
  events: number;
  newPosts: number;
  finalized: number;
  ms: number;
  inputTokens: number;
  cacheReadTokens: number;
  outputTokens: number;
}

const today = () => new Date().toISOString().slice(0, 10);

export class RoundEngine {
  private timer: NodeJS.Timeout | null = null;
  readonly feedback: FeedbackWorker;
  lastSummary: RoundSummary | null = null;

  constructor(
    private store: Store,
    private persist: () => Promise<void> = async () => {},
    persistSoon: () => void = () => {},
  ) {
    this.feedback = new FeedbackWorker(store, (post) => {
      notifyFeedback(post.authorId, post.id);
      broadcastRefresh(store.room.id);
      persistSoon();
    });
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => void this.tick(), config.roundMs);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Why the engine is not running right now, or null if it would run. */
  idleReason(): string | null {
    const room = this.store.room;
    if (room.paused) return "paused";
    if (!this.store.hasPendingHumanPosts()) return "waiting for posts";
    if (room.requestDay === today() && room.requestCount >= config.dailyRequestCap) return "daily cap reached";
    return null;
  }

  async tick() {
    const room = this.store.room;
    if (room.running || this.idleReason()) return;
    if (room.requestDay !== today()) {
      room.requestDay = today();
      room.requestCount = 0;
    }
    room.running = true;
    try {
      this.lastSummary = await this.runRound();
      console.log("round", this.lastSummary);
    } catch (err) {
      console.error("round failed", err);
    } finally {
      room.running = false;
    }
  }

  async runRound(): Promise<RoundSummary> {
    const started = Date.now();
    const store = this.store;
    const round = store.room.round + 1;
    const pool = store.activePosts();

    // Reposts of active posts, so followers of a reposter see them.
    const repostsByPost = new Map<string, string[]>();
    for (const p of pool) {
      const ids = (store.eventsByPost.get(p.id) ?? []).filter((e) => e.type === "repost").map((e) => e.agentId);
      if (ids.length) repostsByPost.set(p.id, ids);
    }
    const ctx = prepare(pool, repostsByPost);

    // Not everyone opens the app every 15 minutes: more active people are online more often.
    const agents = store.activeAgents();
    const online = agents.filter((a) => Math.random() < 0.5 + 0.5 * a.persona.activity);
    const posters = pickPosters(online, Math.max(1, Math.round((rules.postersPerRound * agents.length) / 1000)));

    const feeds = new Map<string, FeedItem[]>();
    const sessions: SessionInput[] = [];
    for (const agent of online) {
      const feed = buildFeed(agent, ctx);
      const mayPost = posters.has(agent.id);
      if (feed.length === 0 && !mayPost) continue;
      feeds.set(agent.id, feed);
      sessions.push({ agent, feed, mayPost });
      for (const it of feed) it.post.counts.impressions++;
    }

    const { results, stats } = await runSessions(store, sessions);
    const eventsBefore = store.events.length;
    const { notifications, newPosts } = applyResults(store, round, feeds, results, posters);
    const finalized = finalizeRound(store, pool);

    store.room.round = round;
    store.room.requestCount += config.fakeLlm ? 0 : sessions.length;
    store.room.lastRoundMs = Date.now() - started;

    await this.persist();
    notifyMembers(notifications);
    broadcastRefresh(store.room.id, { round });
    this.feedback.enqueue(finalized);

    return {
      round,
      sessions: sessions.length,
      ok: stats.ok,
      failed: stats.failed,
      rateLimited: stats.rateLimited,
      timedOut: stats.timedOut,
      events: store.events.length - eventsBefore,
      newPosts: newPosts.length,
      finalized: finalized.length,
      ms: store.room.lastRoundMs,
      inputTokens: stats.inputTokens,
      cacheReadTokens: stats.cacheReadTokens,
      outputTokens: stats.outputTokens,
    };
  }
}

function pickPosters(agents: Agent[], n: number): Set<string> {
  const pool = [...agents];
  const out = new Set<string>();
  while (out.size < Math.min(n, pool.length)) {
    // Weighted by activity: active people post more.
    const total = pool.reduce((s, a) => s + a.persona.activity, 0);
    let r = Math.random() * total;
    const i = pool.findIndex((a) => (r -= a.persona.activity) <= 0);
    out.add(pool.splice(i < 0 ? 0 : i, 1)[0].id);
  }
  return out;
}
