/**
 * Rehearsal / load test: N fake members open the room, join and post over a time window.
 * Each one keeps a socket open and refetches the room on every push, like a real phone, so this
 * measures the fan-out load too, not just the POSTs.
 *   npm run simulate -- --users 150 --seconds 5 --url http://localhost:3000
 */
import { io, type Socket } from "socket.io-client";

const arg = (name: string, d: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const URL_BASE = arg("url", "http://localhost:3000");
const USERS = Number(arg("users", "100"));
const SECONDS = Number(arg("seconds", "60"));
const ROOM = arg("room", "au-u16-ban");

const SAMPLES = {
  for: [
    "Teen anxiety rates doubled in a decade. The ban gives kids their childhood back. Who's with me?",
    "Parents can't fight billion-dollar algorithms alone. The ban finally puts the burden on tech companies.",
    "My daughter deleted Instagram for a month and slept better than she had in years. The ban is worth it.",
  ],
  against: [
    "Banning under-16s won't stop them, it just pushes them to darker corners of the internet with zero moderation.",
    "Age verification means every Aussie handing ID to tech giants. Is that really safer?",
    "For queer kids in small towns, online communities are a lifeline. The ban cuts it.",
  ],
  neutral: [
    "Honest question: has anyone seen real data on whether the ban is working?",
    "The ban isn't the whole answer. Digital literacy in schools matters just as much.",
  ],
};

const getMs: number[] = [];
const postMs: number[] = [];
let pushes = 0;
let failures = 0;

/** Same behaviour as useRoom: one fetch at a time, pushes during a fetch become one follow-up. */
function viewer(memberId: () => string | null) {
  let inFlight = false;
  let again = false;
  return async function refresh() {
    if (inFlight) return void (again = true);
    inFlight = true;
    do {
      again = false;
      const t = Date.now();
      const m = memberId();
      const res = await fetch(`${URL_BASE}/api/rooms/${ROOM}${m ? `?member=${m}` : ""}`).catch(() => null);
      if (res?.ok) {
        await res.arrayBuffer();
        getMs.push(Date.now() - t);
      } else failures++;
    } while (again);
    inFlight = false;
  };
}

async function user(i: number, sockets: Socket[]) {
  let memberId: string | null = null;
  const refresh = viewer(() => memberId);
  const socket = io(URL_BASE, { transports: ["websocket"] });
  sockets.push(socket);
  socket.on("connect", () => socket.emit("join", { roomId: ROOM }));
  socket.on("refresh", () => {
    pushes++;
    setTimeout(() => void refresh(), Math.random() * 500);
  });
  await refresh();

  await new Promise((r) => setTimeout(r, Math.random() * SECONDS * 1000));
  try {
    const join = await fetch(`${URL_BASE}/api/rooms/${ROOM}/join`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ nickname: `tester${i}` }),
    }).then((r) => r.json());
    memberId = join.memberId;
    const side = (["for", "against", "neutral"] as const)[i % 3];
    const list = SAMPLES[side];
    const t = Date.now();
    const res = await fetch(`${URL_BASE}/api/rooms/${ROOM}/posts`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ memberId, side, text: list[i % list.length] }),
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

const pct = (a: number[], p: number) => [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * p))] ?? 0;

async function main() {
  const started = Date.now();
  const sockets: Socket[] = [];
  await Promise.all(Array.from({ length: USERS }, (_, i) => user(i, sockets)));
  // Let the last pushes and refetches land.
  let seen = -1;
  while (seen !== getMs.length) {
    seen = getMs.length;
    await new Promise((r) => setTimeout(r, 2000));
  }
  for (const s of sockets) s.disconnect();
  console.log(`${USERS} users posted within ${SECONDS}s (${((Date.now() - started) / 1000).toFixed(1)}s total)`);
  console.log(`  pushes received: ${pushes}  room GETs: ${getMs.length}  failures: ${failures}`);
  console.log(`  GET  p50 ${pct(getMs, 0.5)}ms  p95 ${pct(getMs, 0.95)}ms  max ${pct(getMs, 1)}ms`);
  console.log(`  POST p50 ${pct(postMs, 0.5)}ms  p95 ${pct(postMs, 0.95)}ms`);
  process.exit(failures ? 1 : 0);
}

main();
