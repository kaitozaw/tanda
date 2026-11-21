import { Store, newRoomState, sim, type Room } from "./store";
import { RoundEngine } from "./roundEngine";
import { buildAudience } from "./audience";
import { loadAll, save, saveSoon } from "./persist";
import { broadcastRefresh } from "./broadcaster";
import { startScheduler } from "./scheduler";
import { config } from "./config";
import type { RoomInput } from "./types";

const g = globalThis as { __building?: Set<string> };
const building = (g.__building ??= new Set());

function register(store: Store): Room {
  const room: Room = { store, engine: new RoundEngine(store, () => save(store), () => saveSoon(store)) };
  sim.rooms.set(store.room.id, room);
  return room;
}

/** Build (or resume building) a room's audience in the background, saving and pushing progress. */
function startBuild(room: Room) {
  const { store } = room;
  const id = store.room.id;
  if (building.has(id)) return;
  building.add(id);
  void buildAudience(store, async () => {
    await save(store);
    broadcastRefresh(id, { audience: store.room.step });
  }).finally(() => building.delete(id));
}

/** Boot once per process: restore every room from Postgres, resume unfinished builds, start the scheduler. */
export async function boot() {
  for (const snap of await loadAll()) {
    const room = register(Store.restore(snap));
    if (room.store.room.status === "generating") startBuild(room);
    // Pitches that were waiting for feedback when the process stopped.
    room.engine.feedback.enqueue([...room.store.posts.values()].filter((p) => p.feedbackStatus === "pending"));
  }
  startScheduler();
  console.log(
    `sim ready: ${sim.rooms.size} rooms restored, ${config.agentCount} agents per new room, ` +
      `${config.fakeLlm ? "FAKE_LLM" : `models ${config.agentModel} / ${config.feedbackModel}`}`,
  );
}

/** "Australia's under-16 social media ban" → "australias-under-16-social-media" (whole words, ≤32 chars). */
const slug = (title: string) => {
  const s = title.toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (s.length <= 32) return s || "room";
  const cut = s.slice(0, 33);
  return cut.slice(0, cut.lastIndexOf("-") > 8 ? cut.lastIndexOf("-") : 32) || "room";
};

/** Create a room and start building its audience. Throws if MAX_ROOMS is reached. */
export function createRoom(input: RoomInput): Room {
  if (sim.rooms.size >= config.maxRooms) throw new Error("Room limit reached");
  let id: string;
  do id = `${slug(input.title)}-${Math.random().toString(36).slice(2, 6)}`;
  while (sim.rooms.has(id));
  const room = register(new Store(newRoomState(id, input)));
  startBuild(room);
  return room;
}

/** Admin reset: delete members, posts, events and the audience, then build a new audience. */
export async function resetRoom(id: string) {
  const old = sim.rooms.get(id);
  if (!old) return;
  if (building.has(id)) throw new Error("Audience is still being built");
  const { title, kind, description, region, targetHint, paused } = old.store.room;
  const room = register(new Store({ ...newRoomState(id, { title, kind, description, region, targetHint }), paused }));
  await save(room.store);
  broadcastRefresh(id, { reset: true });
  startBuild(room);
}
