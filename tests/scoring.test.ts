import { describe, expect, it } from "vitest";
import { applyResults, classifyShift, finalizeRound } from "@/engine/applyEvents";
import type { FeedItem, SessionResult } from "@/engine/types";
import { makeAgent, makePost, storeWith } from "./helpers";

const result = (agentId: string, r: Partial<SessionResult>): SessionResult => ({
  agentId, likes: [], reposts: [], replies: [], follows: [], unfollows: [], post: null, end: null, ...r,
});

describe("classifyShift", () => {
  it("persuasion when moving toward the poster's side", () => {
    expect(classifyShift("for", 40, 55)).toBe("persuasion");
    expect(classifyShift("against", 60, 45)).toBe("persuasion");
  });
  it("backlash when moving away", () => {
    expect(classifyShift("for", 60, 40)).toBe("backlash");
  });
  it("neutral shift for neutral posts", () => {
    expect(classifyShift("neutral", 50, 62)).toBe("neutralShift");
  });
  it("ignores changes under the threshold", () => {
    expect(classifyShift("for", 50, 54)).toBeNull();
    expect(classifyShift("for", 50, 55)).toBe("persuasion");
  });
});

describe("applyResults", () => {
  it("scores every event type per PRODUCT.md and only for posts in the agent's feed", () => {
    const a = makeAgent("a1", 40, { followingIds: [] });
    const post = makePost("p1", "m1", "for");
    const other = makePost("p2", "m1", "for");
    const store = storeWith([a], [post, other]);
    const feeds = new Map<string, FeedItem[]>([["a1", [{ post, viaId: null, slot: "exploration" }]]]);
    const r = result("a1", {
      likes: ["p1", "p1", "p2"], // duplicate and not-in-feed are ignored
      reposts: ["p1"],
      replies: [{ postId: "p1", text: "yes" }],
      follows: ["p1"],
      end: { stanceAfter: 60, influencedBy: ["p1", "p2"] },
    });
    const { notifications } = applyResults(store, 1, feeds, [r], new Set());
    expect(post.counts).toMatchObject({ like: 1, repost: 1, reply: 1, follow: 1, persuasion: 1 });
    expect(post.points).toBe(5 + 10 + 15 + 20 + 160);
    expect(other.points).toBe(0);
    expect(a.stance).toBe(60);
    expect(a.followingIds).toContain("m1");
    expect(store.members.get("m1")!.followerIds).toContain("a1");
    expect(notifications).toHaveLength(5);
  });

  it("caps replies and only allows unfollow when following", () => {
    const a = makeAgent("a1", 50);
    const posts = ["p1", "p2", "p3", "p4"].map((id) => makePost(id, "m1"));
    const store = storeWith([a], posts);
    const feeds = new Map([["a1", posts.map((post) => ({ post, viaId: null, slot: "follow" as const }))]]);
    const r = result("a1", {
      replies: posts.map((p) => ({ postId: p.id, text: "hi" })),
      unfollows: ["p1"],
      end: { stanceAfter: 30, influencedBy: ["p1"] },
    });
    applyResults(store, 1, feeds, [r], new Set());
    expect(posts.reduce((s, p) => s + p.counts.reply, 0)).toBe(3);
    expect(posts[0].counts.unfollow).toBe(0);
    expect(posts[0].counts.backlash).toBe(1);
    expect(posts[0].points).toBe(15 - 80);
  });

  it("only lets picked posters create posts", () => {
    const a = makeAgent("a1", 80);
    const b = makeAgent("a2", 20);
    const store = storeWith([a, b], []);
    const feeds = new Map<string, FeedItem[]>([["a1", []], ["a2", []]]);
    const { newPosts } = applyResults(store, 3, feeds, [result("a1", { post: "Ban it" }), result("a2", { post: "No" })], new Set(["a1"]));
    expect(newPosts).toHaveLength(1);
    expect(newPosts[0]).toMatchObject({ authorId: "a1", side: "for", authorType: "agent" });
  });
});

describe("finalizeRound", () => {
  it("finalizes after 4 rounds and queues only member posts for feedback", () => {
    const human = makePost("p1", "m1");
    const agentPost = makePost("p2", "a1", "for", { authorType: "agent" });
    const store = storeWith([makeAgent("a1")], [human, agentPost]);
    for (let i = 0; i < 3; i++) expect(finalizeRound(store, [human, agentPost])).toHaveLength(0);
    const done = finalizeRound(store, [human, agentPost]);
    expect(done.map((p) => p.id)).toEqual(["p1"]);
    expect(human.finalized && agentPost.finalized).toBe(true);
    expect(human.feedbackStatus).toBe("pending");
  });
});

describe("repeat exposure", () => {
  it("does not count a second like or reply from the same agent on a later round", () => {
    const a = makeAgent("a1", 50);
    const post = makePost("p1", "m1");
    const store = storeWith([a], [post]);
    const feeds = new Map([["a1", [{ post, viaId: null, slot: "follow" as const }]]]);
    const r = result("a1", { likes: ["p1"], replies: [{ postId: "p1", text: "again" }] });
    applyResults(store, 1, feeds, [r], new Set());
    applyResults(store, 2, feeds, [r], new Set());
    expect(post.counts.like).toBe(1);
    expect(post.counts.reply).toBe(1);
  });
});
