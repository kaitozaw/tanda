import { Store, emptyCounts } from "@/engine/store";
import type { Agent, Segment, Persona, Post } from "@/engine/types";

export function makeAgent(id: string, segment: Segment = "customer", extra: Partial<Agent> = {}, persona: Partial<Persona> = {}): Agent {
  return {
    id,
    handle: id,
    followingIds: [],
    followerIds: [],
    persona: {
      market: "au", name: id, age: 30, region: "Sydney, NSW", tier: segment === "customer" ? "crowd" : "power", segment,
      role: "cafe owner", group: segment === "customer" ? "Small business owners" : "Seed angels", priorities: ["cash flow"],
      adoption: 0.5, priceSensitivity: 0.5, scepticism: 0.5, activity: 0.5, openness: 0.5, bio: "",
      ...persona,
    },
    ...extra,
  };
}

export function makePost(id: string, authorId: string, extra: Partial<Post> = {}): Post {
  return {
    id, authorType: "member", authorId, text: "hello", createdAt: Date.now(), createdRound: 0, roundsSeen: 0, seenBy: [],
    counts: emptyCounts(), points: 0, finalized: false, feedback: null, feedbackStatus: "none",
    ...extra,
  };
}

export function storeWith(agents: Agent[], posts: Post[]): Store {
  const s = new Store();
  for (const a of agents) s.agents.set(a.id, a);
  for (const p of posts) s.addPost(p);
  s.members.set("m1", { id: "m1", nickname: "Kai", handle: "kai_1", followerIds: [], joinedAt: 0 });
  return s;
}
