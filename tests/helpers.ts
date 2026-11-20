import { Store, emptyCounts } from "@/engine/store";
import type { Agent, Post, Side } from "@/engine/types";

export function makeAgent(id: string, stance = 50, extra: Partial<Agent> = {}): Agent {
  return {
    id,
    handle: id,
    stance,
    followingIds: [],
    followerIds: [],
    persona: {
      name: id, age: 30, region: "Sydney, NSW", role: "teacher", segment: "Teachers & educators",
      leaning: "centre", interests: [], activity: 0.5, openness: 0.5, bio: "",
    },
    ...extra,
  };
}

export function makePost(id: string, authorId: string, side: Side = "for", extra: Partial<Post> = {}): Post {
  return {
    id, authorType: "member", authorId, text: "hello", side, createdAt: Date.now(), createdRound: 0,
    roundsSeen: 0, counts: emptyCounts(), points: 0, finalized: false, feedback: null, feedbackStatus: "none",
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
