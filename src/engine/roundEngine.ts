import type { Store } from "./store";
import { config } from "./config";
import { planFeeds } from "./feedBuilder";
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
  /** Pitches in this round and the new viewers they got. */
  pitches: number;
  views: number;
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
    const pitches = store.activePosts().filter((p) => p.authorType === "member");
    const background = store.postOrder.map((id) => store.posts.get(id)!).filter((p) => p.authorType === "agent");

    // Each pitch's audience depends only on its own results (feedBuilder), so timing does not matter.
    const feeds = planFeeds(store, pitches, background, store.activeAgents());
    const sessions: SessionInput[] = [];
    const newViewers = new Map(pitches.map((p) => [p.id, 0]));
    for (const [agentId, feed] of feeds) {
      sessions.push({ agent: store.agents.get(agentId)!, feed });
      for (const { post } of feed) {
        if (post.authorType !== "member") continue;
        post.counts.impressions++;
        post.seenBy.push(agentId);
        newViewers.set(post.id, newViewers.get(post.id)! + 1);
      }
    }
    for (const p of pitches) (p.audienceByRound ??= []).push(newViewers.get(p.id)!);

    const { results, stats } = await runSessions(store, sessions);
    const eventsBefore = store.events.length;
    const { notifications } = applyResults(store, round, feeds, results);
    const finalized = finalizeRound(store, pitches);

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
      pitches: pitches.length,
      views: [...newViewers.values()].reduce((a, b) => a + b, 0),
      finalized: finalized.length,
      ms: store.room.lastRoundMs,
      inputTokens: stats.inputTokens,
      cacheReadTokens: stats.cacheReadTokens,
      outputTokens: stats.outputTokens,
    };
  }
}
