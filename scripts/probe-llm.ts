/** One real agent session against a tiny feed: checks the model id, tools and parsing. */
import "dotenv/config";
import { config } from "../src/engine/config";
import { createClient } from "../src/engine/llm";
import { SYSTEM_PROMPT, TOOLS, userMessage } from "../src/engine/prompts";
import { parseToolCalls } from "../src/engine/sessionRunner";
import { Store, emptyCounts } from "../src/engine/store";
import { loadAgentSeeds } from "../src/engine/seed";

const store = new Store();
const seed = loadAgentSeeds()[0];
const agent = { ...seed, followingIds: [], followerIds: [] };
store.agents.set(agent.id, agent);
store.members.set("m1", { id: "m1", nickname: "Kai", handle: "kai_1", followerIds: [], lastPostAt: 0, joinedAt: 0 });
const mk = (id: string, text: string, side: "for" | "against") => ({
  id, authorType: "member" as const, authorId: "m1", text, side, createdAt: 0, createdRound: 0, roundsSeen: 0,
  counts: emptyCounts(), points: 0, finalized: false, feedback: null, feedbackStatus: "none" as const,
});
const feed = [
  { post: mk("p1", "My daughter deleted Instagram for a month and slept better than she had in years. The ban is worth it.", "for"), viaId: null, slot: "follow" as const },
  { post: mk("p2", "Age verification means every Aussie handing ID to tech giants. Is that really safer?", "against"), viaId: null, slot: "recommended" as const },
];

const t0 = Date.now();
const res = await createClient({ maxRetries: 0 }).messages.create({
  model: config.agentModel,
  max_tokens: 800,
  thinking: { type: "disabled" },
  system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
  tools: TOOLS,
  messages: [{ role: "user", content: userMessage(store, agent, feed, true) }],
});
console.log("model:", res.model, "| stop:", res.stop_reason, "| ms:", Date.now() - t0, "| usage:", res.usage);
console.log("persona:", agent.persona.role, "stance", agent.stance);
console.log(JSON.stringify(parseToolCalls(agent.id, res.content), null, 1));
