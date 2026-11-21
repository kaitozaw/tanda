import { sim, type Room } from "./store";
import { config } from "./config";

/**
 * Rooms that may run rounds now: those with nothing stopping them, running ones first (they keep
 * their slot), then by oldest pending pitch. At most MAX_ACTIVE_ROOMS; the rest are queued.
 */
export function activeRoomIds(rooms: Iterable<Room> = sim.rooms.values()): Set<string> {
  const ready = [...rooms].filter((r) => r.engine.idleReason() === null);
  ready.sort((a, b) => {
    if (a.store.room.running !== b.store.room.running) return a.store.room.running ? -1 : 1;
    return (a.store.oldestPendingPitch()?.createdAt ?? 0) - (b.store.oldestPendingPitch()?.createdAt ?? 0);
  });
  return new Set(ready.slice(0, config.maxActiveRooms).map((r) => r.store.room.id));
}

/** What the room header shows: "running", "queued", or why it is idle. */
export function roomStatus(room: Room, active = activeRoomIds()): string {
  if (room.store.room.running) return "running";
  const idle = room.engine.idleReason();
  if (idle) return idle;
  return active.has(room.store.room.id) ? "running" : "queued";
}

/** Every ROUND_MS, start a round in each active room that is not already mid-round. */
export function startScheduler() {
  if (sim.timer) return;
  sim.timer = setInterval(() => {
    for (const id of activeRoomIds()) void sim.rooms.get(id)?.engine.tick();
  }, config.roundMs);
}
