import { Store, emptyCounts, newRoomState } from "@/engine/store";
import type { Agent, AgentType, Persona, Post } from "@/engine/types";

export function makeAgent(id: string, stance = 50, extra: Partial<Omit<Agent, "persona">> & { persona?: Partial<Persona> } = {}): Agent {
  const { persona, ...rest } = extra;
  const type: AgentType = persona?.type ?? "customer";
  return {
    id,
    handle: id,
    stance,
    followingIds: [],
    followerIds: [],
    ...rest,
    persona: {
      name: id, age: 30, region: "Sydney", tier: type === "customer" ? "crowd" : "power", type,
      role: "ops manager", segment: "Freight ops", priorities: ["manual invoicing"],
      scepticism: 0.5, openness: 0.5, activity: 0.5, bio: "",
      ...persona,
    },
  };
}

export function makePost(id: string, authorId: string, extra: Partial<Post> = {}): Post {
  return {
    id, authorType: "member", authorId, text: "hello", createdAt: Date.now(), createdRound: 0, roundsSeen: 0, seenBy: [],
    counts: emptyCounts(), points: 0, finalized: false, feedback: null, feedbackStatus: "none",
    ...extra,
  };
}

export function newStore(id = "test-room"): Store {
  const s = new Store(newRoomState(id, { title: "Freight invoices", kind: "product", description: "Auto invoice reconciliation", region: "Australia", targetHint: "" }));
  s.room.status = "ready";
  s.room.step = "done";
  return s;
}

export function storeWith(agents: Agent[], posts: Post[]): Store {
  const s = newStore();
  for (const a of agents) s.agents.set(a.id, a);
  for (const p of posts) s.addPost(p);
  s.members.set("m1", { id: "m1", nickname: "Kai", handle: "kai_1", followerIds: [], joinedAt: 0 });
  return s;
}
