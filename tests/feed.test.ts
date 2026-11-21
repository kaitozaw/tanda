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
  it("fills follow, pitch, exploration and recommended slots without own posts or duplicates", () => {
    const me = makeAgent("me", "customer", { followingIds: ["f1"] });
    const agentPost = (id: string, author: string, extra = {}) => makePost(id, author, { authorType: "agent", ...extra });
    const followed = Array.from({ length: 8 }, (_, i) => agentPost(`f${i}`, "f1", { roundsSeen: 1 }));
    const reposted = agentPost("r1", "x", { roundsSeen: 1 });
    const others = Array.from({ length: 10 }, (_, i) => agentPost(`o${i}`, `u${i}`, { roundsSeen: 1 }));
    const fresh = Array.from({ length: 5 }, (_, i) => agentPost(`n${i}`, `n${i}`));
    const own = agentPost("own", "me");
    const pitches = ["p1", "p2", "p3"].map((id) => makePost(id, "m1", { roundsSeen: 1 }));
    const pool = [...followed, reposted, ...others, ...fresh, own, ...pitches];
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
    expect(feed.filter((f) => f.post.authorType === "member")).toHaveLength(2); // pitch slots
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

describe("pitch slots", () => {
  it("every feed gets unseen pitches, least-seen first, even with zero engagement", () => {
    const popular = Array.from({ length: 12 }, (_, i) => makePost(`a${i}`, `x${i}`, { authorType: "agent", roundsSeen: 1, counts: { ...makePost("t", "t").counts, reply: 9 } }));
    const pitches = ["p1", "p2", "p3"].map((id) => makePost(id, "m1", { roundsSeen: 1 }));
    pitches[0].seenBy = ["other1", "other2"];
    pitches[1].seenBy = ["me"]; // already seen by this agent
    const ctx = prepare([...popular, ...pitches], new Map(), () => 0.5);
    const ids = buildFeed(makeAgent("me"), ctx).map((f) => f.post.id);
    expect(ids).toContain("p3"); // least seen
    expect(ids).toContain("p1");
    expect(ids).not.toContain("p2");
  });

  it("rotates pitches across agents as viewers are added", () => {
    const pitches = ["p1", "p2", "p3", "p4"].map((id) => makePost(id, "m1", { roundsSeen: 1 }));
    const ctx = prepare(pitches, new Map(), () => 0.5);
    const seenCount = new Map<string, number>();
    for (let i = 0; i < 8; i++) {
      const agent = makeAgent(`g${i}`);
      for (const { post } of buildFeed(agent, ctx).filter((f) => f.post.authorType === "member").slice(0, 2)) {
        ctx.seen.get(post.id)!.add(agent.id);
        seenCount.set(post.id, (seenCount.get(post.id) ?? 0) + 1);
      }
    }
    expect([...seenCount.values()]).toEqual([4, 4, 4, 4]);
  });
});
