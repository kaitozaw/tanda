/**
 * Rehearsal / load test: N fake members join and post over a time window via the public API.
 *   npm run simulate -- --users 100 --seconds 60 --url http://localhost:3000
 */
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

async function user(i: number) {
  await new Promise((r) => setTimeout(r, Math.random() * SECONDS * 1000));
  const join = await fetch(`${URL_BASE}/api/rooms/${ROOM}/join`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ nickname: `tester${i}` }),
  }).then((r) => r.json());
  const side = (["for", "against", "neutral"] as const)[i % 3];
  const list = SAMPLES[side];
  const res = await fetch(`${URL_BASE}/api/rooms/${ROOM}/posts`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ memberId: join.memberId, side, text: list[i % list.length] }),
  });
  if (!res.ok) console.warn(`user ${i}:`, await res.text());
}

async function main() {
  const started = Date.now();
  await Promise.all(Array.from({ length: USERS }, (_, i) => user(i)));
  console.log(`${USERS} users posted in ${((Date.now() - started) / 1000).toFixed(1)}s`);
}

main();
