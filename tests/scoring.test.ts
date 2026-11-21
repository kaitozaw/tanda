import { describe, expect, it } from "vitest";
import { applyResults, finalizeRound, pointsFor } from "@/engine/applyEvents";
import { computeScorecard } from "@/engine/scorecard";
import type { FeedItem, SessionResult } from "@/engine/types";
import { makeAgent, makePost, storeWith } from "./helpers";

const result = (agentId: string, r: Partial<SessionResult>): SessionResult => ({
  agentId, likes: [], reposts: [], replies: [], follows: [], unfollows: [], signals: [], post: null, ...r,
});
const feedOf = (...posts: ReturnType<typeof makePost>[]): FeedItem[] => posts.map((post) => ({ post, viaId: null }));

describe("pointsFor", () => {
  it("engagement by tier, intent by segment, objections 0 (PRODUCT.md → Scoring)", () => {
    const crowd = { tier: "crowd", type: "customer" } as const;
    const power = (type: "investor" | "industry_lead" | "regulator" | "media") => ({ tier: "power", type }) as const;
    expect([pointsFor("like", crowd), pointsFor("repost", crowd), pointsFor("reply", crowd), pointsFor("follow", crowd), pointsFor("unfollow", crowd)]).toEqual([2, 5, 5, 10, -10]);
    expect([pointsFor("like", power("media")), pointsFor("repost", power("media")), pointsFor("follow", power("media"))]).toEqual([2, 15, 20]);
    expect([pointsFor("intent", crowd), pointsFor("intent", power("investor")), pointsFor("intent", power("industry_lead")), pointsFor("intent", power("regulator")), pointsFor("intent", power("media"))]).toEqual([30, 100, 80, 60, 60]);
    // Objections are feedback, not a penalty.
    for (const p of [crowd, power("investor"), power("regulator")]) expect(pointsFor("objection", p)).toBe(0);
  });
});

describe("applyResults", () => {
  it("scores engagement and signals, only for posts in the agent's feed; the score is the sum", () => {
    const a = makeAgent("a1");
    const post = makePost("p1", "m1");
    const other = makePost("p2", "m1");
    const store = storeWith([a], [post, other]);
    const r = result("a1", {
      likes: ["p1", "p1", "p2"], // duplicate and not-in-feed are ignored
      reposts: ["p1"],
      replies: [{ postId: "p1", text: "yes" }],
      follows: ["p1"],
      signals: [{ postId: "p1", kind: "intent", reason: "Would save me hours" }, { postId: "p2", kind: "intent", reason: "not in feed" }],
    });
    const { notifications } = applyResults(store, 1, new Map([["a1", feedOf(post)]]), [r], new Set());
    expect(post.counts).toMatchObject({ like: 1, repost: 1, reply: 1, follow: 1, intent: 1 });
    expect(post.points).toBe(2 + 5 + 5 + 10 + 30);
    expect(other.points).toBe(0);
    expect(a.followingIds).toContain("m1");
    expect(store.members.get("m1")!.followerIds).toContain("a1");
    expect(notifications).toHaveLength(5);
    expect(notifications.find((n) => n.type === "intent")).toMatchObject({ segment: "customer", text: "Would save me hours" });
  });

  it("uses the segment's signal points for power agents", () => {
    const vc = makeAgent("v1", "investor");
    const gov = makeAgent("g1", "regulator");
    const post = makePost("p1", "m1");
    const store = storeWith([vc, gov], [post]);
    const feeds = new Map([["v1", feedOf(post)], ["g1", feedOf(post)]]);
    applyResults(store, 1, feeds, [
      result("v1", { reposts: ["p1"], signals: [{ postId: "p1", kind: "intent", reason: "Strong traction" }] }),
      result("g1", { signals: [{ postId: "p1", kind: "objection", reason: "Privacy issue" }] }),
    ], new Set());
    expect(post.points).toBe(15 + 100 + 0);
  });

  it("keeps signals on pitches only, max 2 per session, one per kind per agent, reason cut to 20 words", () => {
    const a = makeAgent("a1");
    const pitch = makePost("p1", "m1");
    const pitch2 = makePost("p2", "m1");
    const agentPost = makePost("p3", "a9", { authorType: "agent" });
    const store = storeWith([a, makeAgent("a9")], [pitch, pitch2, agentPost]);
    const long = Array.from({ length: 30 }, (_, i) => `w${i}`).join(" ");
    const r = result("a1", {
      signals: [
        { postId: "p3", kind: "intent", reason: "agent post" }, // dropped: not a pitch
        { postId: "p1", kind: "intent", reason: long },
        { postId: "p1", kind: "intent", reason: "again" }, // dropped: duplicate
        { postId: "p2", kind: "objection", reason: "too pricey" },
        { postId: "p2", kind: "intent", reason: "over the cap" }, // dropped: max 2
      ],
    });
    applyResults(store, 1, new Map([["a1", feedOf(pitch, pitch2, agentPost)]]), [r], new Set());
    expect(pitch.counts).toMatchObject({ intent: 1, objection: 0 });
    expect(pitch2.counts).toMatchObject({ intent: 0, objection: 1 });
    expect(agentPost.counts.intent).toBe(0);
    expect([pitch.points, pitch2.points]).toEqual([30, 0]);
    expect(store.eventsByPost.get("p1")![0].text!.split(" ")).toHaveLength(20);
  });

  it("caps replies and only allows unfollow when following", () => {
    const a = makeAgent("a1");
    const posts = ["p1", "p2", "p3", "p4"].map((id) => makePost(id, "m1"));
    const store = storeWith([a], posts);
    const r = result("a1", { replies: posts.map((p) => ({ postId: p.id, text: "hi" })), unfollows: ["p1"] });
    applyResults(store, 1, new Map([["a1", feedOf(...posts)]]), [r], new Set());
    expect(posts.reduce((s, p) => s + p.counts.reply, 0)).toBe(3);
    expect(posts[0].counts.unfollow).toBe(0);
  });

  it("only lets picked posters create posts", () => {
    const store = storeWith([makeAgent("a1"), makeAgent("a2")], []);
    const feeds = new Map<string, FeedItem[]>([["a1", []], ["a2", []]]);
    const { newPosts } = applyResults(store, 3, feeds, [result("a1", { post: "Rent is up again" }), result("a2", { post: "No" })], new Set(["a1"]));
    expect(newPosts).toHaveLength(1);
    expect(newPosts[0]).toMatchObject({ authorId: "a1", authorType: "agent", seenBy: [] });
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

describe("repeat exposure", () => {
  it("does not count a second like, reply or signal from the same agent on a later round", () => {
    const a = makeAgent("a1");
    const post = makePost("p1", "m1");
    const store = storeWith([a], [post]);
    const feeds = new Map([["a1", feedOf(post)]]);
    const r = result("a1", {
      likes: ["p1"],
      replies: [{ postId: "p1", text: "again" }],
      signals: [{ postId: "p1", kind: "intent", reason: "nice" }],
    });
    applyResults(store, 1, feeds, [r], new Set());
    applyResults(store, 2, feeds, [r], new Set());
    expect(post.counts).toMatchObject({ like: 1, reply: 1, intent: 1 });
  });
});

describe("computeScorecard", () => {
  it("one row per segment: unique agents who saw, reacted, signalled intent and objection", () => {
    const c1 = makeAgent("c1"), c2 = makeAgent("c2"), c3 = makeAgent("c3");
    const vc = makeAgent("v1", "investor");
    const post = makePost("p1", "m1", { seenBy: ["c1", "c2", "c3", "v1"] });
    const store = storeWith([c1, c2, c3, vc], [post]);
    const ev = (agentId: string, type: Parameters<typeof store.addEvent>[0]["type"]) => {
      store.addEvent({ round: 1, agentId, type, postId: "p1", text: null });
      post.counts[type]++;
    };
    ev("c1", "intent"); ev("c1", "like");
    ev("c2", "like"); ev("c2", "reply");
    ev("c3", "objection");
    ev("v1", "intent");
    post.counts.impressions = 10;

    const s = computeScorecard(store, post);
    expect(s).toMatchObject({ reach: 4, views: 10 });
    expect(s.reactionRate).toBeCloseTo(0.3);
    expect(s.segments.map((g) => g.segment)).toEqual(["customer", "investor", "industry_lead", "regulator", "media"]);
    expect(s.segments[0]).toEqual({ segment: "customer", seen: 3, reacted: 2, intent: 1, objection: 1 });
    expect(s.segments[1]).toEqual({ segment: "investor", seen: 1, reacted: 0, intent: 1, objection: 0 });
    expect(s.segments[4]).toEqual({ segment: "media", seen: 0, reacted: 0, intent: 0, objection: 0 });
  });
});
