import { describe, expect, it } from "vitest";
import { rules } from "@/engine/config";
import { addMember, connectAgents, loadAgentSeeds, loadPostSeeds, seedPosts } from "@/engine/seed";
import { Store } from "@/engine/store";
import { AGENT_TYPES, type Agent } from "@/engine/types";
import { makeAgent } from "./helpers";

describe("audience file", () => {
  it("the open market has 1,000 agents in the PRODUCT.md mix, all carrying the market", () => {
    const seeds = loadAgentSeeds(rules.roomId);
    expect(seeds).toHaveLength(1000);
    const count = (t: string) => seeds.filter((s) => s.persona.type === t).length;
    expect({ investor: count("investor"), industry_lead: count("industry_lead"), regulator: count("regulator"), media: count("media") }).toEqual(rules.mix);
    expect(count("customer")).toBe(880);
    expect(seeds.every((s) => s.persona.market === rules.roomId)).toBe(true);
    expect(seeds.filter((s) => s.persona.group === "Sceptics").length).toBeGreaterThanOrEqual(100);
    expect(new Set(seeds.map((s) => s.handle)).size).toBe(1000);
  });

  it("any prefix keeps every type (AGENT_COUNT takes a prefix)", () => {
    const first100 = loadAgentSeeds(rules.roomId).slice(0, 100);
    for (const t of AGENT_TYPES) expect(first100.some((s) => s.persona.type === t)).toBe(true);
  });
});

describe("follow graph", () => {
  it("power accounts collect the most followers; media follow the power tier, investors follow industry", () => {
    const types = ["investor", "industry_lead", "regulator", "media"] as const;
    const agents: Agent[] = [
      ...Array.from({ length: 40 }, (_, i) => makeAgent(`p${i}`, types[i % 4])),
      ...Array.from({ length: 400 }, (_, i) => makeAgent(`c${i}`)),
    ];
    connectAgents(agents);
    const avg = (xs: Agent[]) => xs.reduce((n, a) => n + a.followerIds.length, 0) / xs.length;
    const power = agents.filter((a) => a.persona.tier === "power");
    expect(avg(power)).toBeGreaterThan(avg(agents.filter((a) => a.persona.tier === "crowd")) * 3);
    const media = power.find((a) => a.persona.type === "media")!;
    for (const b of power) if (b.id !== media.id) expect(media.followingIds).toContain(b.id);
    const vc = power.find((a) => a.persona.type === "investor")!;
    for (const b of power.filter((x) => x.persona.type === "industry_lead")) expect(vc.followingIds).toContain(b.id);
    expect(agents.every((a) => !a.followingIds.includes(a.id) && new Set(a.followingIds).size === a.followingIds.length)).toBe(true);
  });

  it("new members get crowd followers only", () => {
    const s = new Store();
    for (let i = 0; i < 50; i++) s.agents.set(`p${i}`, makeAgent(`p${i}`, "investor"));
    for (let i = 0; i < 950; i++) s.agents.set(`c${i}`, makeAgent(`c${i}`));
    const m = addMember(s, "Kai");
    expect(m.followerIds).toHaveLength(rules.memberStartFollowers);
    expect(m.followerIds.every((id) => s.agents.get(id)!.persona.tier === "crowd")).toBe(true);
  });
});

describe("starter posts", () => {
  it("the open market has 20 valid starter posts, none of them pitches", () => {
    const seeds = loadPostSeeds(rules.roomId);
    expect(seeds).toHaveLength(20);
    for (const s of seeds) {
      expect(AGENT_TYPES).toContain(s.type);
      expect(s.text.length).toBeGreaterThan(0);
      expect(s.text.length).toBeLessThanOrEqual(rules.maxPostChars);
    }
  });

  it("a room without a file has none", () => {
    expect(loadPostSeeds("no-such-room")).toEqual([]);
  });

  it("each post goes to a different active agent of the post's type, oldest first", () => {
    const s = new Store();
    ["customer", "customer", "investor", "regulator", "media"].forEach((t, i) => s.agents.set(`a${i}`, makeAgent(`a${i}`, t as Agent["persona"]["type"])));
    seedPosts(s, [
      { type: "customer", text: "one" },
      { type: "investor", text: "two" },
      { type: "customer", text: "three" },
      { type: "media", text: "four" },
    ], 1_000_000);
    const posts = s.postOrder.map((id) => s.posts.get(id)!);
    expect(posts.map((p) => p.text)).toEqual(["one", "two", "three", "four"]);
    expect(posts.map((p) => s.agents.get(p.authorId)!.persona.type)).toEqual(["customer", "investor", "customer", "media"]);
    for (const p of posts) expect(p).toMatchObject({ authorType: "agent", finalized: false, seenBy: [] });
    expect(new Set(posts.map((p) => p.authorId)).size).toBe(4);
    expect(posts[0].createdAt).toBeLessThan(posts[3].createdAt);
  });

  it("skips a post when no agent of its type is left", () => {
    const s = new Store();
    s.agents.set("a0", makeAgent("a0", "investor"));
    seedPosts(s, [{ type: "investor", text: "one" }, { type: "investor", text: "two" }]);
    expect(s.posts.size).toBe(1);
  });
});
