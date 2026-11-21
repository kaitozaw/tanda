import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Server } from "socket.io";
import { broadcastRefresh } from "@/engine/broadcaster";
import { config, rules } from "@/engine/config";
import { sim } from "@/engine/store";
import { newStore } from "./helpers";

describe("broadcastRefresh", () => {
  const emits: unknown[] = [];
  beforeEach(() => {
    vi.useFakeTimers();
    emits.length = 0;
    sim.io = { to: () => ({ emit: (_: string, p: unknown) => emits.push(p) }) } as unknown as Server;
  });
  afterEach(() => {
    vi.runAllTimers();
    vi.useRealTimers();
    sim.io = undefined;
  });

  it("emits at most once per window and merges a burst into one trailing push", () => {
    broadcastRefresh("r1");
    expect(emits).toHaveLength(1); // first call goes out right away
    for (let i = 0; i < 100; i++) broadcastRefresh("r1", i === 50 ? { round: 3 } : {});
    expect(emits).toHaveLength(1);
    vi.advanceTimersByTime(config.refreshMs);
    expect(emits).toHaveLength(2);
    expect(emits[1]).toEqual({ round: 3 }); // payload of a merged call is kept
  });

  it("throttles each room separately", () => {
    broadcastRefresh("a");
    broadcastRefresh("b");
    expect(emits).toHaveLength(2);
  });
});

describe("post cooldown", () => {
  it("allows one post per member per cooldown", () => {
    const s = newStore();
    expect(s.takePostSlot("m1", 1000)).toBe(0);
    expect(s.takePostSlot("m1", 2000)).toBe(rules.postCooldownMs - 1000);
    expect(s.takePostSlot("m2", 2000)).toBe(0); // other members are not affected
    expect(s.takePostSlot("m1", 1000 + rules.postCooldownMs)).toBe(0);
  });
});

describe("scheduler", () => {
  it("runs at most MAX_ACTIVE_ROOMS rooms, keeps running rooms, queues the rest by oldest pitch", async () => {
    const { activeRoomIds, roomStatus } = await import("@/engine/scheduler");
    const { RoundEngine } = await import("@/engine/roundEngine");
    const { makePost } = await import("./helpers");
    const rooms = Array.from({ length: config.maxActiveRooms + 2 }, (_, i) => {
      const store = newStore(`r${i}`);
      store.addPost(makePost(`p${i}`, "m1", { createdAt: 1000 - i })); // later rooms have older pitches
      return { store, engine: new RoundEngine(store) };
    });
    rooms[0].store.room.running = true;
    const idle = { store: newStore("idle"), engine: undefined as unknown as InstanceType<typeof RoundEngine> };
    idle.engine = new RoundEngine(idle.store); // no pitches
    const active = activeRoomIds([...rooms, idle]);
    expect(active.size).toBe(config.maxActiveRooms);
    expect(active.has("r0")).toBe(true); // running keeps its slot even with the newest pitch
    expect(active.has(`r${rooms.length - 1}`)).toBe(true); // oldest pitch next
    expect(roomStatus(rooms[1], active)).toBe("queued");
    expect(roomStatus(idle, active)).toBe("waiting for pitches");
  });
});
