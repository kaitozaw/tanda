import type Anthropic from "@anthropic-ai/sdk";
import { createClient } from "./llm";
import pLimit from "p-limit";
import type { Agent, FeedItem, SessionResult } from "./types";
import type { Store } from "./store";
import { config } from "./config";
import { getMarket, OPEN_MARKET } from "./markets";
import { SYSTEM_PROMPT, TOOLS, marketContext, userMessage } from "./prompts";

export interface SessionInput {
  agent: Agent;
  feed: FeedItem[];
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
      case "intent":
      case "objection":
        if (id) r.signals.push({ postId: id, kind: b.name, reason: typeof input.reason === "string" ? input.reason.trim() : "" });
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
      system: [
        { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
        { type: "text", text: marketContext(getMarket(store.room.id) ?? OPEN_MARKET), cache_control: { type: "ephemeral" } },
      ],
      tools: TOOLS,
      messages: [{ role: "user", content: userMessage(store, s.agent, s.feed) }],
    },
    { signal: AbortSignal.timeout(config.sessionTimeoutMs) },
  );
  stats.inputTokens += res.usage.input_tokens;
  stats.cacheReadTokens += res.usage.cache_read_input_tokens ?? 0;
  stats.outputTokens += res.usage.output_tokens;
  if (res.stop_reason === "refusal") return emptyResult(s.agent.id);
  return parseToolCalls(s.agent.id, res.content);
}

// ---------- FAKE_LLM: random behaviour shaped by the persona, no API calls (free UI checks) ----------

export function runFake(s: SessionInput, rand = Math.random): SessionResult {
  const r = emptyResult(s.agent.id);
  const p = s.agent.persona;
  for (const { post } of s.feed) {
    const pr = p.activity * 0.3 * (1 - p.scepticism * 0.5);
    if (rand() < pr) r.likes.push(post.id);
    if (rand() < pr * 0.2) r.reposts.push(post.id);
    if (rand() < pr * 0.15) r.replies.push({ postId: post.id, text: "(fake reply)" });
    if (rand() < pr * 0.05) r.follows.push(post.id);
    if (post.authorType !== "member") continue;
    // Intent gets rarer with scepticism, objections more common.
    if (rand() < 0.08 * (1 - p.scepticism)) r.signals.push({ postId: post.id, kind: "intent", reason: "(fake reason)" });
    else if (rand() < 0.05 * p.scepticism) r.signals.push({ postId: post.id, kind: "objection", reason: "(fake objection)" });
  }
  return r;
}

// ---------- runner ----------

export async function runSessions(store: Store, sessions: SessionInput[]): Promise<{ results: SessionResult[]; stats: RunStats }> {
  const stats: RunStats = { ok: 0, failed: 0, rateLimited: 0, timedOut: 0, inputTokens: 0, cacheReadTokens: 0, outputTokens: 0 };
  if (config.fakeLlm) {
    stats.ok = sessions.length;
    return { results: sessions.map((s) => runFake(s)), stats };
  }
  const limit = pLimit(config.concurrency);
  const results = await Promise.all(
    sessions.map((s) =>
      limit(async () => {
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
