import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Server } from "socket.io";
import { broadcastRefresh } from "@/engine/broadcaster";
import { config, rules } from "@/engine/config";
import { Store, sim } from "@/engine/store";

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
    const s = new Store();
    expect(s.takePostSlot("m1", 1000)).toBe(0);
    expect(s.takePostSlot("m1", 2000)).toBe(rules.postCooldownMs - 1000);
    expect(s.takePostSlot("m2", 2000)).toBe(0); // other members are not affected
    expect(s.takePostSlot("m1", 1000 + rules.postCooldownMs)).toBe(0);
  });
});
