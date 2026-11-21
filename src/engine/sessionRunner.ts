import type Anthropic from "@anthropic-ai/sdk";
import { createClient } from "./llm";
import { SIGNAL_KINDS, type Agent, type FeedItem, type SessionResult, type SignalKind } from "./types";
import type { Store } from "./store";
import { config, rules } from "./config";
import { llmLimit } from "./limiter";
import { SYSTEM_PROMPT, TOOLS, roomContext, userMessage } from "./prompts";

export interface SessionInput {
  agent: Agent;
  feed: FeedItem[];
  mayPost: boolean;
}

export interface RunStats {
  ok: number;
  failed: number;
  /** Of `failed`: 429 from the API (raise the org's rate limit) and session timeouts. */
  rateLimited: number;
  timedOut: number;
  inputTokens: number;
  cacheReadTokens: number;
  outputTokens: number;
}

const emptyResult = (agentId: string): SessionResult => ({
  agentId,
  likes: [],
  reposts: [],
  replies: [],
  follows: [],
  unfollows: [],
  signals: [],
  post: null,
  end: null,
});

let client: Anthropic | null = null;
const getClient = () => (client ??= createClient({ maxRetries: 0 }));

/** Turn the model's parallel tool calls into a SessionResult. Tool results are never sent back. */
export function parseToolCalls(agentId: string, blocks: Anthropic.ContentBlock[]): SessionResult {
  const r = emptyResult(agentId);
  for (const b of blocks) {
    if (b.type !== "tool_use") continue;
    const input = b.input as Record<string, unknown>;
    const id = typeof input.post_id === "string" ? input.post_id : "";
    const text = typeof input.text === "string" ? input.text.trim() : "";
    switch (b.name) {
      case "like": if (id) r.likes.push(id); break;
      case "repost": if (id) r.reposts.push(id); break;
      case "reply": if (id && text) r.replies.push({ postId: id, text }); break;
      case "follow": if (id) r.follows.push(id); break;
      case "unfollow": if (id) r.unfollows.push(id); break;
      case "post": if (text) r.post = text; break;
      case "signal": {
        const kind = input.kind as SignalKind;
        const reason = typeof input.reason === "string" ? input.reason.trim() : "";
        if (id && SIGNAL_KINDS.includes(kind)) r.signals.push({ postId: id, kind, reason });
        break;
      }
      case "end_session":
        if (!r.end && typeof input.stance_after === "number") {
          r.end = {
            stanceAfter: input.stance_after,
            influencedBy: Array.isArray(input.influenced_by) ? input.influenced_by.filter((x): x is string => typeof x === "string") : [],
          };
        }
        break;
    }
  }
  return r;
}

async function runReal(store: Store, s: SessionInput, stats: RunStats): Promise<SessionResult> {
  const res = await getClient().messages.create(
    {
      model: config.agentModel,
      max_tokens: 800,
      thinking: { type: "disabled" },
      // Shared rules (all rooms), then the idea card (this room), then the agent: two cache breakpoints.
      system: [
        { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
        { type: "text", text: roomContext(store.room), cache_control: { type: "ephemeral" } },
      ],
      tools: TOOLS,
      messages: [{ role: "user", content: userMessage(store, s.agent, s.feed, s.mayPost) }],
    },
    { signal: AbortSignal.timeout(config.sessionTimeoutMs) },
  );
  stats.inputTokens += res.usage.input_tokens;
  stats.cacheReadTokens += res.usage.cache_read_input_tokens ?? 0;
  stats.outputTokens += res.usage.output_tokens;
  if (res.stop_reason === "refusal") return emptyResult(s.agent.id);
  return parseToolCalls(s.agent.id, res.content);
}

// ---------- FAKE_LLM: random but stance-biased behaviour, no API calls (free UI checks) ----------

export function runFake(s: SessionInput, rand = Math.random): SessionResult {
  const r = emptyResult(s.agent.id);
  const p0 = s.agent.persona;
  const allowed = rules.signals[p0.type];
  for (const { post } of s.feed) {
    const pitch = post.authorType === "member";
    // Supporters engage with pitches more; sceptics less.
    const p = p0.activity * 0.3 * (pitch ? (0.4 + s.agent.stance / 100) * (1.2 - p0.scepticism) : 0.6);
    if (rand() < p) r.likes.push(post.id);
    if (rand() < p * 0.2) r.reposts.push(post.id);
    if (rand() < p * 0.15) r.replies.push({ postId: post.id, text: "(fake reply)" });
    if (rand() < p * 0.05) r.follows.push(post.id);
    if (pitch && r.signals.length < rules.maxSignalsPerSession && rand() < 0.12) {
      const positive = rand() * 100 < s.agent.stance;
      const kinds = allowed.filter((k) => (positive ? !NEGATIVE.has(k) : NEGATIVE.has(k)));
      const kind = kinds[Math.floor(rand() * kinds.length)] ?? "objection";
      r.signals.push({ postId: post.id, kind, reason: `(fake ${kind.replace("_", " ")})` });
    }
  }
  const target = s.feed.find((f) => f.post.authorType === "member")?.post;
  const moved = target && rand() < p0.openness * 0.15;
  const shift = moved ? (rand() < 0.75 ? 8 : -8) : 0;
  if (s.mayPost) r.post = `(fake post by @${s.agent.handle})`;
  r.end = { stanceAfter: Math.max(0, Math.min(100, s.agent.stance + shift)), influencedBy: moved ? [target.id] : [] };
  return r;
}

const NEGATIVE = new Set<SignalKind>(["pass", "compete", "concern", "objection"]);

// ---------- runner ----------

export async function runSessions(store: Store, sessions: SessionInput[]): Promise<{ results: SessionResult[]; stats: RunStats }> {
  const stats: RunStats = { ok: 0, failed: 0, rateLimited: 0, timedOut: 0, inputTokens: 0, cacheReadTokens: 0, outputTokens: 0 };
  if (config.fakeLlm) {
    stats.ok = sessions.length;
    return { results: sessions.map((s) => runFake(s)), stats };
  }
  const results = await Promise.all(
    sessions.map((s) =>
      llmLimit(async () => {
        try {
          const r = await runReal(store, s, stats);
          stats.ok++;
          return r;
        } catch (err) {
          stats.failed++; // counts as no action
          const e = err as { status?: number; name?: string };
          if (e.status === 429) stats.rateLimited++;
          else if (e.name === "TimeoutError" || e.name === "AbortError" || e.name === "APIUserAbortError") stats.timedOut++;
          return emptyResult(s.agent.id);
        }
      }),
    ),
  );
  if (stats.failed > sessions.length * 0.05) {
    console.warn(`sessions failed: ${stats.failed}/${sessions.length} (rate limited ${stats.rateLimited}, timed out ${stats.timedOut})`);
  }
  return { results, stats };
}
