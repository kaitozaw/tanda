import { describe, expect, it } from "vitest";
import { DEFAULT_PLAN, buildAudience, connectAudience, instantiateAgents, mixCounts, normalisePlan } from "@/engine/audience";
import { addMember } from "@/engine/seed";
import { newStore } from "./helpers";

describe("mixCounts", () => {
  it("matches PRODUCT.md at 1,000 and keeps every power type when scaled down", () => {
    expect(mixCounts(1000)).toEqual({ customer: 880, investor: 40, industry_lead: 30, regulator: 20, media: 30 });
    const small = mixCounts(100);
    expect(Object.values(small).reduce((a, b) => a + b, 0)).toBe(100);
    expect(Math.min(small.investor, small.industry_lead, small.regulator, small.media)).toBeGreaterThanOrEqual(2);
  });
});

describe("normalisePlan", () => {
  it("adds a sceptic segment, sums shares to 100 and fills missing power types", () => {
    const plan = normalisePlan(
      {
        locations: [],
        segments: [
          { name: "Ops", description: "", kind: "target", share: 70, roles: [], painPoints: [], ageRange: { min: 80, max: 20 }, stanceRange: { min: -5, max: 150 } },
          { name: "Bookkeepers", description: "", kind: "adjacent", share: 50, roles: ["bookkeeper"], painPoints: ["x"], ageRange: { min: 20, max: 60 }, stanceRange: { min: 20, max: 50 } },
        ],
        investors: [],
        industry_leads: [{ name: "Incumbent", role: "VP at accounting software", priorities: ["moat"], stanceRange: { min: 10, max: 30 }, scepticismRange: { min: 2, max: 0.5 } }],
        regulators: [],
        media: [],
      },
      "Australia",
    );
    expect(plan.segments.some((s) => s.kind === "sceptic")).toBe(true);
    expect(plan.segments.reduce((n, s) => n + s.share, 0)).toBeCloseTo(100);
    expect(plan.segments.filter((s) => s.kind === "sceptic").reduce((n, s) => n + s.share, 0)).toBeGreaterThanOrEqual(10 - 1e-9);
    expect(plan.segments[0].ageRange).toEqual({ min: 20, max: 80 });
    expect(plan.segments[0].stanceRange).toEqual({ min: 0, max: 100 });
    expect(plan.segments[0].roles).toEqual(["Ops"]);
    expect(plan.archetypes.investor).toEqual(DEFAULT_PLAN.archetypes.investor);
    expect(plan.archetypes.industry_lead[0].scepticismRange).toEqual({ min: 0.5, max: 1 });
    expect(plan.locations).toEqual(["Australia"]);
  });
});

describe("instantiateAgents + connectAudience", () => {
  const store = newStore("freight-abcd");
  const agents = instantiateAgents(store.room, DEFAULT_PLAN, 1000);
  connectAudience(agents, 1);

  it("builds the PRODUCT.md mix, reproducibly from the room id", () => {
    expect(agents).toHaveLength(1000);
    const count = (t: string) => agents.filter((a) => a.persona.type === t).length;
    expect([count("customer"), count("investor"), count("industry_lead"), count("regulator"), count("media")]).toEqual([880, 40, 30, 20, 30]);
    expect(agents.every((a) => a.stance >= 0 && a.stance <= 100 && a.persona.priorities.length > 0)).toBe(true);
    expect(new Set(agents.map((a) => a.handle)).size).toBe(1000);
    const again = instantiateAgents(store.room, DEFAULT_PLAN, 1000);
    expect(again.map((a) => a.persona.name)).toEqual(agents.map((a) => a.persona.name));
  });

  it("makes power holders the influencers", () => {
    const avg = (tier: string) => {
      const xs = agents.filter((a) => a.persona.tier === tier);
      return xs.reduce((n, a) => n + a.followerIds.length, 0) / xs.length;
    };
    expect(avg("power")).toBeGreaterThan(avg("crowd") * 3);
    const media = agents.find((a) => a.persona.type === "media")!;
    expect(agents.filter((a) => a.persona.tier === "power" && a.id !== media.id).every((a) => media.followingIds.includes(a.id))).toBe(true);
  });
});

describe("buildAudience (fake mode)", () => {
  it("goes plan → agents → bios → ready, and gives early joiners their followers", async () => {
    const store = newStore("decision-room");
    store.room.status = "generating";
    store.room.step = "plan";
    const early = addMember(store, "Early");
    expect(early.followerIds).toHaveLength(0);
    const steps: string[] = [];
    await buildAudience(store, () => void steps.push(store.room.step));
    expect(steps).toEqual(["agents", "bios", "done"]);
    expect(store.room.status).toBe("ready");
    expect(store.agents.size).toBeGreaterThan(0);
    expect(early.followerIds.length).toBeGreaterThan(0);
    expect(early.followerIds.every((id) => store.agents.get(id)!.persona.tier === "crowd")).toBe(true);
  });
});
