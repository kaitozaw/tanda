import { describe, expect, it } from "vitest";
import { audienceSize, planFeeds, reactionRate } from "@/engine/feedBuilder";
import { rules } from "@/engine/config";
import { buildFollowGraph, rng } from "@/engine/seed";
import type { Agent, Post } from "@/engine/types";
import { makeAgent, makePost, storeWith } from "./helpers";

/** 1,000 agents, members m1..m5 each followed by 100 random agents, 20 background posts, the given pitches. */
function room(pitches: Post[]) {
  const agents: Agent[] = Array.from({ length: 1000 }, (_, i) => makeAgent(`a${i}`));
  const background = Array.from({ length: 20 }, (_, i) => makePost(`s${i}`, `a${900 + i}`, { authorType: "agent" }));
  const store = storeWith(agents, [...background, ...pitches]);
  const r = rng(3);
  for (let m = 1; m <= 5; m++) {
    const followers = [...agents].sort(() => r() - 0.5).slice(0, 100).map((a) => a.id);
    store.members.set(`m${m}`, { id: `m${m}`, nickname: `Team ${m}`, handle: `team${m}`, followerIds: followers, joinedAt: 0 });
  }
  return { store, agents, background };
}
const pitchCount = (feeds: ReturnType<typeof planFeeds>, id: string) => [...feeds.values()].filter((f) => f.some((it) => it.post.id === id)).length;
const rand = rng(7);

describe("planFeeds: exposure does not depend on other pitches", () => {
  it("round 1: the author's followers + the random sample, the same alone or next to other pitches", () => {
    const alone = makePost("p1", "m1");
    const a = room([alone]);
    const solo = pitchCount(planFeeds(a.store, [alone], a.background, a.agents, rand), "p1");
    expect(solo).toBe(100 + rules.exposure.seedRandom);

    // Five teams posting in the same round (more than an agent's 3 pitch slots can overlap).
    const crowd = Array.from({ length: 5 }, (_, i) => makePost(`p${i + 1}`, `m${i + 1}`));
    const b = room(crowd);
    const feeds = planFeeds(b.store, crowd, b.background, b.agents, rand);
    for (const p of crowd) expect(pitchCount(feeds, p.id)).toBe(solo);
  });

  it("later rounds: audience grows with the pitch's own reaction rate, from minNext to maxNext", () => {
    const p = makePost("p1", "m1", { roundsSeen: 1, audienceByRound: [100] });
    const { store, agents } = room([p]);
    store.room.round = 1;
    expect(audienceSize(store, p, agents.length)).toBe(rules.exposure.minNext);
    for (let i = 0; i < 15; i++) store.addEvent({ round: 1, agentId: `a${i}`, type: "like", postId: "p1", text: null });
    expect(reactionRate(store, p, 1)).toBeCloseTo(0.15);
    expect(audienceSize(store, p, agents.length)).toBe((rules.exposure.minNext + rules.exposure.maxNext) / 2);
    for (let i = 15; i < 40; i++) store.addEvent({ round: 1, agentId: `a${i}`, type: "intent", postId: "p1", text: null });
    expect(audienceSize(store, p, agents.length)).toBe(rules.exposure.maxNext); // capped at targetRate
  });

  it("word of mouth: followers of reactors come first, reposters show as reposted_by", () => {
    const p = makePost("p1", "m1", { roundsSeen: 1, audienceByRound: [10], seenBy: ["a500"] });
    const { store, agents, background } = room([p]);
    store.room.round = 1;
    const fans = ["a700", "a701", "a702"];
    store.agents.get("a500")!.followerIds = fans;
    store.addEvent({ round: 1, agentId: "a500", type: "repost", postId: "p1", text: null });
    const feeds = planFeeds(store, [p], background, agents, rand);
    for (const f of fans) expect(feeds.get(f)?.find((it) => it.post.id === "p1")?.viaId).toBe("a500");
    expect(feeds.has("a500")).toBe(false); // never shown twice
  });

  it("feeds: at most maxPitches pitches, filled with background posts, never the agent's own", () => {
    // 25 pitches in one round need more pitch slots than 1,000 agents × 3 have: crowded on purpose.
    const pitches = Array.from({ length: 25 }, (_, i) => makePost(`p${i}`, `m${(i % 5) + 1}`));
    const { store, agents, background } = room(pitches);
    const feeds = planFeeds(store, pitches, background, agents, rand);
    for (const [agentId, feed] of feeds) {
      expect(feed.filter((it) => it.post.authorType === "member").length).toBeLessThanOrEqual(rules.feed.maxPitches);
      expect(feed).toHaveLength(rules.feed.size);
      expect(feed.some((it) => it.post.authorType === "agent" && it.post.authorId === agentId)).toBe(false);
    }
    expect(feeds.size).toBeGreaterThan(900);
  });

  it("only agents with a pitch to see get a feed", () => {
    const { store, agents, background } = room([]);
    expect(planFeeds(store, [], background, agents, rand).size).toBe(0);
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
