import { getStore, Store } from "./store";
import { seedAgents } from "./seed";
import { RoundEngine, getEngine, setEngine } from "./roundEngine";
import { load, migrate, saveDirty, wipe } from "../db/persist";
import { broadcastRefresh } from "./broadcaster";
import { config } from "./config";

/** Boot once per process: restore from Postgres or seed fresh, then start the round timer. */
export async function boot() {
  const store = getStore();
  await migrate();
  const restored = await load(store);
  if (!restored) {
    seedAgents(store);
    store.markRoomDirty();
    await saveDirty(store);
  }
  const engine = new RoundEngine(store, () => saveDirty(store));
  setEngine(engine);
  // Posts that were waiting for feedback when the process stopped.
  engine.feedback.enqueue([...store.posts.values()].filter((p) => p.feedbackStatus === "pending"));
  engine.start();
  console.log(
    `sim ready: ${store.agents.size} agents, ${store.posts.size} posts, round ${store.room.round}, ` +
      `${restored ? "restored from Postgres" : "fresh seed"}, ${config.fakeLlm ? "FAKE_LLM" : "real API"}`,
  );
}

/** Admin reset: wipe members, posts and events, and re-seed agents (stance and follows). */
export async function reset() {
  const old = getStore();
  const fresh = new Store();
  fresh.room.paused = old.room.paused;
  fresh.room.requestDay = old.room.requestDay;
  fresh.room.requestCount = old.room.requestCount;
  seedAgents(fresh);
  Object.assign(old, fresh);
  await wipe();
  old.markRoomDirty();
  await saveDirty(old);
  broadcastRefresh(old.room.id, { reset: true });
}

export const engine = () => getEngine();
