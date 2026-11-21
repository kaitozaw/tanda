import { describe, expect, it } from "vitest";
import { applyResults, classifyShift, finalizeRound } from "@/engine/applyEvents";
import { computeScorecard } from "@/engine/scorecard";
import type { FeedItem, SessionResult } from "@/engine/types";
import { makeAgent, makePost, storeWith } from "./helpers";

const result = (agentId: string, r: Partial<SessionResult>): SessionResult => ({
  agentId, likes: [], reposts: [], replies: [], follows: [], unfollows: [], signals: [], post: null, end: null, ...r,
});
const feedOf = (...posts: ReturnType<typeof makePost>[]): FeedItem[] => posts.map((post) => ({ post, viaId: null }));

describe("classifyShift", () => {
  it("persuasion up, backlash down, nothing under the threshold", () => {
    expect(classifyShift(40, 55)).toBe("persuasion");
    expect(classifyShift(60, 40)).toBe("backlash");
    expect(classifyShift(50, 54)).toBeNull();
    expect(classifyShift(50, 45)).toBe("backlash");
  });
});

describe("applyResults", () => {
  it("scores crowd engagement, signals and persuasion per PRODUCT.md, only for posts in the feed", () => {
    const a = makeAgent("a1", 40);
    const post = makePost("p1", "m1");
    const other = makePost("p2", "m1");
    const store = storeWith([a], [post, other]);
    const r = result("a1", {
      likes: ["p1", "p1", "p2"], // duplicate and not-in-feed are ignored
      reposts: ["p1"],
      replies: [{ postId: "p1", text: "yes" }],
      follows: ["p1"],
      signals: [{ postId: "p1", kind: "would_pay", reason: "We lose two days a month on this" }],
      end: { stanceAfter: 60, influencedBy: ["p1", "p2"] },
    });
    const { notifications } = applyResults(store, 1, new Map([["a1", feedOf(post)]]), [r], new Set());
    expect(post.counts).toMatchObject({ like: 1, repost: 1, reply: 1, follow: 1, would_pay: 1, persuasion: 1 });
    expect(post.points).toBe(2 + 5 + 5 + 10 + 50 + 40);
    expect(other.points).toBe(0);
    expect(a.stance).toBe(60);
    expect(a.followingIds).toContain("m1");
    expect(store.members.get("m1")!.followerIds).toContain("a1");
    expect(notifications).toHaveLength(6);
  });

  it("weights power-tier events higher", () => {
    const vc = makeAgent("v1", 40, { persona: { type: "investor" } });
    const post = makePost("p1", "m1");
    const store = storeWith([vc], [post]);
    const r = result("v1", {
      reposts: ["p1"],
      signals: [{ postId: "p1", kind: "want_meeting", reason: "Strong wedge" }],
      end: { stanceAfter: 52, influencedBy: ["p1"] },
    });
    applyResults(store, 1, new Map([["v1", feedOf(post)]]), [r], new Set());
    expect(post.points).toBe(15 + 100 + 120);
  });

  it("drops signals not allowed for the agent's type, on non-pitches, repeats, and beyond 2 per session", () => {
    const c = makeAgent("c1", 50);
    const pitch = makePost("p1", "m1");
    const pitch2 = makePost("p2", "m1");
    const agentPost = makePost("p3", "c9", { authorType: "agent" });
    const store = storeWith([c], [pitch, pitch2, agentPost]);
    const feeds = new Map([["c1", feedOf(pitch, pitch2, agentPost)]]);
    const r = result("c1", {
      signals: [
        { postId: "p1", kind: "want_meeting", reason: "not an investor" }, // wrong type
        { postId: "p3", kind: "would_try", reason: "not a pitch" },
        { postId: "p1", kind: "would_try", reason: "one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty twentyone" },
        { postId: "p1", kind: "would_try", reason: "duplicate" },
        { postId: "p2", kind: "objection", reason: "too pricey" },
        { postId: "p2", kind: "would_pay", reason: "third signal" },
      ],
    });
    applyResults(store, 1, feeds, [r], new Set());
    expect(pitch.counts.want_meeting).toBe(0);
    expect(agentPost.counts.would_try).toBe(0);
    expect(pitch.counts.would_try).toBe(1);
    expect(pitch2.counts.objection).toBe(1);
    expect(pitch2.counts.would_pay).toBe(0);
    const reason = store.eventsByPost.get("p1")!.find((e) => e.type === "would_try")!.text!;
    expect(reason.split(" ")).toHaveLength(20);
    applyResults(store, 2, feeds, [result("c1", { signals: [{ postId: "p1", kind: "would_try", reason: "again" }] })], new Set());
    expect(pitch.counts.would_try).toBe(1); // once per agent per pitch, across rounds
  });

  it("caps replies, only allows unfollow when following, and backlash costs points", () => {
    const a = makeAgent("a1", 50);
    const posts = ["p1", "p2", "p3", "p4"].map((id) => makePost(id, "m1"));
    const store = storeWith([a], posts);
    const r = result("a1", {
      replies: posts.map((p) => ({ postId: p.id, text: "hi" })),
      unfollows: ["p1"],
      end: { stanceAfter: 30, influencedBy: ["p1"] },
    });
    applyResults(store, 1, new Map([["a1", feedOf(...posts)]]), [r], new Set());
    expect(posts.reduce((s, p) => s + p.counts.reply, 0)).toBe(3);
    expect(posts[0].counts.unfollow).toBe(0);
    expect(posts[0].counts.backlash).toBe(1);
    expect(posts[0].points).toBe(5 - 40);
  });

  it("does not credit stance shifts to agent posts", () => {
    const a = makeAgent("a1", 50);
    const agentPost = makePost("p1", "a9", { authorType: "agent" });
    const store = storeWith([a], [agentPost]);
    applyResults(store, 1, new Map([["a1", feedOf(agentPost)]]), [result("a1", { end: { stanceAfter: 70, influencedBy: ["p1"] } })], new Set());
    expect(agentPost.counts.persuasion).toBe(0);
    expect(a.stance).toBe(70);
  });

  it("only lets picked posters create posts", () => {
    const store = storeWith([makeAgent("a1", 80), makeAgent("a2", 20)], []);
    const feeds = new Map<string, FeedItem[]>([["a1", []], ["a2", []]]);
    const { newPosts } = applyResults(store, 3, feeds, [result("a1", { post: "Invoices take forever" }), result("a2", { post: "No" })], new Set(["a1"]));
    expect(newPosts).toHaveLength(1);
    expect(newPosts[0]).toMatchObject({ authorId: "a1", authorType: "agent" });
  });
});

describe("finalizeRound", () => {
  it("finalizes after 4 rounds and queues only pitches for feedback", () => {
    const human = makePost("p1", "m1");
    const agentPost = makePost("p2", "a1", { authorType: "agent" });
    const store = storeWith([makeAgent("a1")], [human, agentPost]);
    for (let i = 0; i < 3; i++) expect(finalizeRound(store, [human, agentPost])).toHaveLength(0);
    const done = finalizeRound(store, [human, agentPost]);
    expect(done.map((p) => p.id)).toEqual(["p1"]);
    expect(human.finalized && agentPost.finalized).toBe(true);
    expect(human.feedbackStatus).toBe("pending");
  });
});

describe("computeScorecard", () => {
  it("measures demand among target customers who saw it, investors, risk and support shift by type", () => {
    const t1 = makeAgent("t1", 40, { persona: { segment: "Freight ops" } });
    const t2 = makeAgent("t2", 40, { persona: { segment: "Freight ops" } });
    const sc = makeAgent("s1", 10, { persona: { segment: "Sceptics" } });
    const vc = makeAgent("v1", 40, { persona: { type: "investor", segment: "Logistics VCs" } });
    const gov = makeAgent("g1", 40, { persona: { type: "regulator", segment: "Tax office" } });
    const post = makePost("p1", "m1", { seenBy: ["t1", "t2", "s1", "v1", "g1"] });
    const store = storeWith([t1, t2, sc, vc, gov], [post]);
    store.room.audiencePlan = {
      locations: ["Sydney"],
      segments: [
        { name: "Freight ops", description: "", kind: "target", share: 85, roles: ["ops"], painPoints: ["x"], ageRange: { min: 20, max: 60 }, stanceRange: { min: 30, max: 60 } },
        { name: "Sceptics", description: "", kind: "sceptic", share: 15, roles: ["owner"], painPoints: ["y"], ageRange: { min: 20, max: 60 }, stanceRange: { min: 5, max: 30 } },
      ],
      archetypes: { investor: [], industry_lead: [], regulator: [], media: [] },
    };
    const feeds = new Map(["t1", "t2", "s1", "v1", "g1"].map((id) => [id, feedOf(post)]));
    applyResults(store, 1, feeds, [
      result("t1", { signals: [{ postId: "p1", kind: "would_try", reason: "yes" }, { postId: "p1", kind: "would_pay", reason: "yes" }], end: { stanceAfter: 60, influencedBy: ["p1"] } }),
      result("s1", { signals: [{ postId: "p1", kind: "would_try", reason: "maybe" }] }), // sceptic: not target demand
      result("v1", { signals: [{ postId: "p1", kind: "want_meeting", reason: "good" }] }),
      result("g1", { signals: [{ postId: "p1", kind: "concern", reason: "GST rules" }] }),
    ], new Set());
    const s = computeScorecard(store, post);
    expect(s.demand).toEqual({ seen: 2, yes: 1, pct: 50 });
    expect(s.pay).toEqual({ seen: 3, yes: 1, pct: 33.3 });
    expect(s.investors).toEqual({ seen: 1, meeting: 1, pass: 0 });
    expect(s.risk).toEqual({ concerns: 1, reasons: ["GST rules"] });
    const customers = s.stakeholders.find((r) => r.type === "customer")!;
    expect(customers).toMatchObject({ seen: 3, positive: 4, negative: 0, avgShift: 6.7 });
    expect(s.stakeholders.find((r) => r.type === "regulator")).toMatchObject({ seen: 1, negative: 1 });
  });
});
