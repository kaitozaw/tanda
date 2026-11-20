import type Anthropic from "@anthropic-ai/sdk";
import { createClient } from "./llm";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import pLimit from "p-limit";
import type { Feedback, FeedbackStats, Post } from "./types";
import type { Store } from "./store";
import { config, rules } from "./config";

export function computeStats(store: Store, post: Post): FeedbackStats {
  const events = store.eventsByPost.get(post.id) ?? [];
  // reacted: people who used a reaction tool (like / repost / reply / follow / unfollow), counted once.
  // persuaded: view changes toward the poster (persuasion, or any shift on a neutral post). backlash: away.
  const bySeg = new Map<string, FeedbackStats["segments"][number]>();
  const reacted = new Set<string>();
  for (const e of events) {
    const seg = store.agents.get(e.agentId)?.persona.segment ?? "Other";
    const row = bySeg.get(seg) ?? { segment: seg, reacted: 0, persuaded: 0, backlash: 0 };
    if (e.type === "persuasion" || e.type === "neutralShift") row.persuaded++;
    else if (e.type === "backlash") row.backlash++;
    else if (!reacted.has(e.agentId)) {
      row.reacted++;
      reacted.add(e.agentId);
    }
    bySeg.set(seg, row);
  }
  const c = post.counts;
  const reactions = c.like + c.repost + c.reply + c.follow + c.unfollow;
  return {
    views: c.impressions,
    reactionRate: c.impressions ? reactions / c.impressions : 0,
    segments: [...bySeg.values()].sort((a, b) => b.reacted + b.persuaded - (a.reacted + a.persuaded)),
  };
}

const FeedbackSchema = z.object({
  verdict: z.string().describe("One sentence: how the post performed and why."),
  whatWorked: z.array(z.string()).describe("1-3 short points."),
  improvements: z.array(z.string()).describe("2-4 concrete, actionable improvements."),
  rewrite: z.string().describe("An improved version of the post, max 280 characters."),
});

let client: Anthropic | null = null;

async function llmFeedback(store: Store, post: Post, stats: FeedbackStats): Promise<Omit<Feedback, "stats">> {
  client ??= createClient();
  const events = store.eventsByPost.get(post.id) ?? [];
  const replies = events
    .filter((e) => e.type === "reply")
    .slice(0, 10)
    .map((e) => {
      const a = store.agents.get(e.agentId);
      return `- ${a?.persona.role} (stance ${e.stanceBefore ?? a?.stance}/100): ${e.text}`;
    })
    .join("\n");
  const segs = stats.segments
    .slice(0, 8)
    .map((s) => `- ${s.segment}: reacted ${s.reacted}, persuaded ${s.persuaded}, backlash ${s.backlash}`)
    .join("\n");
  const c = post.counts;
  const res = await client.messages.parse({
    model: config.feedbackModel,
    max_tokens: 2000,
    output_config: { effort: "low", format: zodOutputFormat(FeedbackSchema) },
    messages: [
      {
        role: "user",
        content: `You are a social media strategist reviewing a campaign post tested on 1,000 simulated Australian users in a community about "${rules.topic}". The author is campaigning ${post.side === "neutral" ? "as a neutral voice" : post.side === "for" ? "for the ban" : "against the ban"}. Give practical feedback to help the next post reach further and persuade more people, without causing backlash.

<post>${post.text}</post>

Results after one simulated hour: views ${stats.views}, reaction rate ${(stats.reactionRate * 100).toFixed(1)}%, likes ${c.like}, reposts ${c.repost}, replies ${c.reply}, follows ${c.follow}, unfollows ${c.unfollow}, persuaded ${c.persuasion}, backlash ${c.backlash}, points ${post.points}.

By audience segment:
${segs || "- no reactions"}

Sample replies:
${replies || "- none"}`,
      },
    ],
  });
  if (res.stop_reason === "refusal" || !res.parsed_output) throw new Error("no feedback");
  return res.parsed_output;
}

function templateFeedback(post: Post, stats: FeedbackStats): Omit<Feedback, "stats"> {
  const top = stats.segments[0]?.segment ?? "no segment";
  return {
    verdict: `${stats.views} views with a ${(stats.reactionRate * 100).toFixed(1)}% reaction rate; strongest with ${top}.`,
    whatWorked: [post.text.length > 120 ? "Gave enough context for people to react to." : "Short and easy to read."],
    improvements: ["Add a concrete example or number.", "End with a question to invite replies.", "Speak to the people who disagree, not only your side."],
    rewrite: post.text,
  };
}

export class FeedbackWorker {
  private limit = pLimit(5);
  constructor(private store: Store, private onDone: (post: Post) => void) {}

  enqueue(posts: Post[]) {
    for (const post of posts) void this.limit(() => this.run(post));
  }

  private async run(post: Post) {
    const stats = computeStats(this.store, post);
    try {
      const fb = config.fakeLlm ? templateFeedback(post, stats) : await llmFeedback(this.store, post, stats);
      post.feedback = { ...fb, stats };
      post.feedbackStatus = "done";
    } catch (err) {
      console.warn("feedback failed", post.id, (err as Error).message);
      post.feedback = { ...templateFeedback(post, stats), stats };
      post.feedbackStatus = "error";
    }
    this.onDone(post);
  }
}
