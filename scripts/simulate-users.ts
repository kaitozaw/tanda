/**
 * Rehearsal / load test: creates N rooms (or uses --room), waits for their audiences, then fake
 * members open each room, join and pitch over a time window. Each one keeps a socket open and
 * refetches the room on every push, like a real phone, so this measures the fan-out load too.
 *   npm run simulate -- --users 150 --seconds 5
 *   npm run simulate -- --rooms 3 --users 50 --seconds 10
 *   npm run simulate -- --room <existing-room-id> --users 100
 */
import { io, type Socket } from "socket.io-client";

const arg = (name: string, d: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const URL_BASE = arg("url", "http://localhost:3000");
const USERS = Number(arg("users", "100")); // per room
const SECONDS = Number(arg("seconds", "60"));
const ROOMS = Number(arg("rooms", "1"));
const ROOM = arg("room", "");

const IDEA = {
  title: "Australia's under-16 social media ban",
  kind: "decision",
  region: "Australia",
  description:
    "Australia bans under-16s from holding accounts on major social media platforms. Platforms must take reasonable steps to verify age or face fines up to $49.5M. Parents cannot consent on a child's behalf. Messaging, gaming and education apps are exempt.",
  targetHint: "Parents of children aged 10-15",
};

const SAMPLES = [
  "Teen anxiety rates doubled in a decade. The ban gives kids their childhood back and puts the burden on billion-dollar platforms, not parents.",
  "My daughter deleted Instagram for a month and slept better than she had in years. The ban makes that the default, not a battle at home.",
  "Age checks don't need your ID: platforms can estimate age without storing documents. Safety and privacy can both win.",
  "Teachers see it every day: phones out, attention gone. The ban backs schools up with a clear national rule.",
  "This isn't about banning kids from the internet. Messaging, gaming and learning apps stay. It's about algorithms built to hook them.",
];

const getMs: number[] = [];
const postMs: number[] = [];
let pushes = 0;
let failures = 0;

const json = async (path: string, body?: unknown) => {
  const res = await fetch(`${URL_BASE}${path}`, body === undefined ? undefined : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(`${path}: ${data.error ?? res.status}`);
  return data;
};

/** Same behaviour as useRoom: one fetch at a time, pushes during a fetch become one follow-up. */
function viewer(roomId: string, memberId: () => string | null) {
  let inFlight = false;
  let again = false;
  return async function refresh() {
    if (inFlight) return void (again = true);
    inFlight = true;
    do {
      again = false;
      const t = Date.now();
      const m = memberId();
      const res = await fetch(`${URL_BASE}/api/rooms/${roomId}${m ? `?member=${m}` : ""}`).catch(() => null);
      if (res?.ok) {
        await res.arrayBuffer();
        getMs.push(Date.now() - t);
      } else failures++;
    } while (again);
    inFlight = false;
  };
}

async function user(roomId: string, i: number, sockets: Socket[]) {
  let memberId: string | null = null;
  const refresh = viewer(roomId, () => memberId);
  const socket = io(URL_BASE, { transports: ["websocket"] });
  sockets.push(socket);
  socket.on("connect", () => socket.emit("join", { roomId }));
  socket.on("refresh", () => {
    pushes++;
    setTimeout(() => void refresh(), Math.random() * 500);
  });
  await refresh();

  await new Promise((r) => setTimeout(r, Math.random() * SECONDS * 1000));
  try {
    memberId = (await json(`/api/rooms/${roomId}/join`, { nickname: `tester${i}` })).memberId;
    const t = Date.now();
    const res = await fetch(`${URL_BASE}/api/rooms/${roomId}/posts`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ memberId, text: SAMPLES[i % SAMPLES.length] }),
    });
    postMs.push(Date.now() - t);
    if (!res.ok) {
      failures++;
      console.warn(`user ${i}:`, await res.text());
    }
    await refresh();
  } catch (err) {
    failures++;
    console.warn(`user ${i}:`, (err as Error).message);
  }
}

/** Create a room and wait until its audience is ready. */
async function readyRoom(n: number): Promise<string> {
  const { id } = await json("/api/rooms", { ...IDEA, title: ROOMS > 1 ? `${IDEA.title} #${n + 1}` : IDEA.title });
  const t = Date.now();
  for (;;) {
    const v = await json(`/api/rooms/${id}`);
    if (v.room.buildStatus === "ready") break;
    if (v.room.buildStatus === "error") throw new Error(`${id}: audience build failed`);
    await new Promise((r) => setTimeout(r, 1000));
  }
  console.log(`room ${id} ready in ${((Date.now() - t) / 1000).toFixed(1)}s`);
  return id;
}

const pct = (a: number[], p: number) => [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * p))] ?? 0;

async function main() {
  const roomIds = ROOM ? [ROOM] : await Promise.all(Array.from({ length: ROOMS }, (_, n) => readyRoom(n)));
  const started = Date.now();
  const sockets: Socket[] = [];
  await Promise.all(roomIds.flatMap((id) => Array.from({ length: USERS }, (_, i) => user(id, i, sockets))));
  // Let the last pushes and refetches land.
  let seen = -1;
  while (seen !== getMs.length) {
    seen = getMs.length;
    await new Promise((r) => setTimeout(r, 2000));
  }
  for (const s of sockets) s.disconnect();
  console.log(`${USERS} users × ${roomIds.length} rooms pitched within ${SECONDS}s (${((Date.now() - started) / 1000).toFixed(1)}s total)`);
  console.log(`  pushes received: ${pushes}  room GETs: ${getMs.length}  failures: ${failures}`);
  console.log(`  GET  p50 ${pct(getMs, 0.5)}ms  p95 ${pct(getMs, 0.95)}ms  max ${pct(getMs, 1)}ms`);
  console.log(`  POST p50 ${pct(postMs, 0.5)}ms  p95 ${pct(postMs, 0.95)}ms`);
  console.log(`  rooms: ${roomIds.map((id) => `${URL_BASE}/rooms/${id}`).join("  ")}`);
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
