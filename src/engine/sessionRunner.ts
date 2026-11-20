import type Anthropic from "@anthropic-ai/sdk";
import { createClient } from "./llm";
import pLimit from "p-limit";
import type { Agent, FeedItem, Post, SessionResult } from "./types";
import type { Store } from "./store";
import { config, rules } from "./config";
import { SYSTEM_PROMPT, TOOLS, userMessage } from "./prompts";

export interface SessionInput {
  agent: Agent;
  feed: FeedItem[];
  mayPost: boolean;
}

export interface RunStats {
  ok: number;
  failed: number;
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
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
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

// ---------- FAKE_LLM: persona-biased random behaviour, no API calls ----------

const sideStance = { for: 85, against: 15, neutral: 50 } as const;

const FAKE_REPLIES = {
  agree: ["100% this.", "Couldn't agree more, mate.", "Exactly what I've been saying.", "Finally someone said it.", "This is the bit people miss."],
  disagree: ["Hard disagree.", "That's not how it works for actual teens.", "Who's going to enforce this though?", "Bit of a stretch, honestly.", "Have you talked to any kids about this?"],
};
const FAKE_POSTS = {
  for: ["Kids' brains aren't ready for algorithmic feeds. The ban is overdue.", "As a parent, the ban takes the pressure off. Nobody wants to be the only kid without TikTok."],
  against: ["Banning under-16s just pushes them to worse corners of the internet.", "Age verification = everyone handing ID to tech companies. No thanks."],
  neutral: ["Genuinely torn on the ban. Protecting kids matters, but so does how we do it.", "Would love to see actual data on the ban a year from now."],
};

function quality(post: Post) {
  if (post.authorType === "agent") return 1;
  const len = post.text.length;
  return 0.6 + 0.8 * Math.min(1, len / 180) + (/[?!]/.test(post.text) ? 0.1 : 0);
}

export function runFake(s: SessionInput, rand = Math.random): SessionResult {
  const r = emptyResult(s.agent.id);
  const { activity, openness } = s.agent.persona;
  const following = new Set(s.agent.followingIds);
  let stance = s.agent.stance;
  for (const { post } of s.feed) {
    const agree = 1 - Math.abs(s.agent.stance - sideStance[post.side]) / 100;
    const proof = 1 + Math.log1p(post.counts.like + 2 * post.counts.repost) / 6;
    const p = activity * (0.02 + 0.12 * agree) * proof * quality(post);
    if (rand() < p) r.likes.push(post.id);
    if (rand() < p * 0.3) r.reposts.push(post.id);
    if (r.replies.length < rules.maxRepliesPerSession) {
      if (rand() < p * 0.25) r.replies.push({ postId: post.id, text: FAKE_REPLIES.agree[Math.floor(rand() * 5)] });
      else if (agree < 0.35 && rand() < activity * 0.12) r.replies.push({ postId: post.id, text: FAKE_REPLIES.disagree[Math.floor(rand() * 5)] });
    }
    if (!following.has(post.authorId) && rand() < p * 0.12) r.follows.push(post.id);
    if (following.has(post.authorId) && agree < 0.2 && rand() < 0.05) r.unfollows.push(post.id);
  }
  const influenced: string[] = [];
  const target = s.feed[Math.floor(rand() * s.feed.length)]?.post;
  if (target) {
    const agree = 1 - Math.abs(s.agent.stance - sideStance[target.side]) / 100;
    if (rand() < openness * 0.12 * quality(target)) {
      const dir = target.side === "for" ? 1 : target.side === "against" ? -1 : stance > 50 ? -1 : 1;
      stance += dir * (10 + Math.floor(rand() * 12));
      influenced.push(target.id);
    } else if (agree < 0.25 && rand() < 0.04) {
      const dir = target.side === "for" ? -1 : 1;
      stance += dir * (10 + Math.floor(rand() * 8));
      influenced.push(target.id);
    }
  }
  if (s.mayPost && rand() < 0.7) {
    const side = stance >= 60 ? "for" : stance <= 40 ? "against" : "neutral";
    r.post = FAKE_POSTS[side][Math.floor(rand() * 2)];
  }
  r.end = { stanceAfter: Math.max(0, Math.min(100, stance)), influencedBy: influenced };
  return r;
}

// ---------- runner ----------

export async function runSessions(store: Store, sessions: SessionInput[]): Promise<{ results: SessionResult[]; stats: RunStats }> {
  const stats: RunStats = { ok: 0, failed: 0, inputTokens: 0, cacheReadTokens: 0, outputTokens: 0 };
  if (config.fakeLlm) {
    // Simulate API latency a little so the UI behaves like the real thing.
    await new Promise((r) => setTimeout(r, 1500));
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
        } catch {
          stats.failed++; // timeout, 429, etc. counts as no action
          return emptyResult(s.agent.id);
        }
      }),
    ),
  );
  return { results, stats };
}
