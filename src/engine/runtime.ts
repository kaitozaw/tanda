import { Store, sim } from "./store";
import { seedAgents } from "./seed";
import { RoundEngine } from "./roundEngine";
import { load, save, saveSoon } from "./persist";
import { broadcastRefresh } from "./broadcaster";
import { config } from "./config";

/** Boot once per process: restore from Postgres or seed fresh, then start the round timer. */
export async function boot() {
  const store = sim.store;
  const restored = await load(store);
  if (!restored) {
    seedAgents(store);
    await save(store);
  }
  sim.engine = new RoundEngine(store, () => save(store), () => saveSoon(store));
  // Posts that were waiting for feedback when the process stopped.
  sim.engine.feedback.enqueue([...store.posts.values()].filter((p) => p.feedbackStatus === "pending"));
  sim.engine.start();
  console.log(
    `sim ready: ${store.activeAgents().length} agents, ${store.posts.size} posts, round ${store.room.round}, ` +
      `${restored ? "restored from Postgres" : "fresh seed"}, ${config.fakeLlm ? "FAKE_LLM" : `model ${config.agentModel}`}`,
  );
}

/** Admin reset: wipe members, posts and events, and re-seed agents (stance and follows). */
export async function reset() {
  const store = sim.store;
  const fresh = new Store();
  fresh.room = { ...fresh.room, paused: store.room.paused, requestDay: store.room.requestDay, requestCount: store.room.requestCount };
  seedAgents(fresh);
  store.restore(fresh.snapshot());
  await save(store);
  broadcastRefresh(store.room.id, { reset: true });
}
