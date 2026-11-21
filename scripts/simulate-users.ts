/**
 * Rehearsal / load test: N fake members open the room, join and pitch over a time window.
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
const ROOM = arg("room", "au");

const SAMPLES = [
  "Rostr: rosters for cafes in 2 taps. Staff swap shifts themselves, you approve. $19/month per venue, first month free.",
  "Tired of chasing invoices? PaidUp texts your clients a pay link and nudges them until they pay. Built for tradies. $9/month.",
  "LunchBox plans a week of school lunches from what's already in your fridge and cuts the shopping list. Free for 3 kids.",
  "SplitHouse: one place for share-house rent, bills and groceries. Auto-splits, reminds, settles. $2/month each.",
  "GrandLink: a tablet app with 4 big buttons so grandparents can video call, see photos and get reminders. $49 one-off.",
  "Rural Clinic Online: bulk-billed telehealth GPs with offline-first booking for patchy connections. Free with Medicare.",
];

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
    const t = Date.now();
    const res = await fetch(`${URL_BASE}/api/rooms/${ROOM}/posts`, {
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
