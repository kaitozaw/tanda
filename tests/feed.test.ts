import { describe, expect, it } from "vitest";
import { buildFeed, prepare, rank } from "@/engine/feedBuilder";
import { buildFollowGraph } from "@/engine/seed";
import { makeAgent, makePost } from "./helpers";

describe("rank", () => {
  it("rises with engagement and decays with simulated age", () => {
    const a = makePost("a", "m1");
    const b = makePost("b", "m1", { counts: { ...a.counts, reply: 3 } });
    const old = makePost("c", "m1", { counts: { ...a.counts, reply: 3 }, roundsSeen: 3 });
    expect(rank(b)).toBeGreaterThan(rank(a));
    expect(rank(b)).toBeGreaterThan(rank(old));
  });
});

describe("buildFeed", () => {
  it("fills follow, recommended and exploration slots without own posts or duplicates", () => {
    const me = makeAgent("me", 50, { followingIds: ["f1"] });
    const followed = Array.from({ length: 8 }, (_, i) => makePost(`f${i}`, "f1", { roundsSeen: 1 }));
    const reposted = makePost("r1", "x", { roundsSeen: 1 });
    const others = Array.from({ length: 10 }, (_, i) => makePost(`o${i}`, `u${i}`, { roundsSeen: 1 }));
    const fresh = Array.from({ length: 5 }, (_, i) => makePost(`n${i}`, `n${i}`));
    const own = makePost("own", "me", { authorType: "agent" });
    const pool = [...followed, reposted, ...others, ...fresh, own];
    const ctx = prepare(pool, new Map([["r1", ["f1"]]]), () => 0.3);
    const feed = buildFeed(me, ctx);
    const ids = feed.map((f) => f.post.id);
    expect(feed).toHaveLength(12);
    expect(new Set(ids).size).toBe(12);
    expect(ids).not.toContain("own");
    const fromFollows = feed.filter((f) => f.post.authorId === "f1" || f.viaId === "f1");
    expect(fromFollows).toHaveLength(5);
    expect(fromFollows.find((f) => f.post.id === "r1")?.viaId).toBe("f1");
    expect(feed.filter((f) => f.post.roundsSeen === 0).length).toBeGreaterThanOrEqual(2); // exploration slots
  });
});

describe("buildFollowGraph", () => {
  it("produces a skewed follower distribution", () => {
    const agents = Array.from({ length: 1000 }, (_, i) => makeAgent(`a${i}`));
    buildFollowGraph(agents);
    const followers = agents.map((a) => a.followerIds.length).sort((x, y) => y - x);
    const median = followers[500];
    expect(followers[0]).toBeGreaterThan(median * 5);
    expect(agents.every((a) => !a.followingIds.includes(a.id))).toBe(true);
  });
});
