/**
 * Generates data/agents.json: 1,000 personas for the "Australia's under-16 social media ban" room.
 * Attributes come from rules below. With ANTHROPIC_API_KEY set (and no --no-llm), Haiku writes a
 * short bio for each persona in batches; otherwise a template bio is used.
 *
 *   npm run agents:generate            # rules + Haiku bios
 *   npm run agents:generate -- --no-llm
 */
import "dotenv/config";
import fs from "node:fs";
import { createClient, hasLlmKey } from "../src/engine/llm";
import { config } from "../src/engine/config";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { Persona } from "../src/engine/types";

const COUNT = 1000;
const OUT = "data/agents.json";

// Deterministic RNG so the file is reproducible.
let seed = 20261121;
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];
const weighted = <T,>(xs: readonly (readonly [T, number])[]) => {
  const total = xs.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [x, w] of xs) if ((r -= w) <= 0) return x;
  return xs[xs.length - 1][0];
};
const normal = (mean: number, sd: number) => {
  const u = 1 - rand();
  const v = rand();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

// segment, weight, age range, stance mean (support for the ban, 0-100), roles
const SEGMENTS = [
  ["Parents of teens", 18, [35, 55], 72, ["parent of a 13-year-old", "parent of two teens", "single mum of a 14-year-old", "dad of a 12-year-old"]],
  ["Teenagers 16-17", 6, [16, 17], 25, ["year 11 student", "year 12 student", "apprentice"]],
  ["University students", 9, [18, 24], 35, ["uni student", "law student", "psychology student", "comp sci student"]],
  ["Teachers & educators", 8, [25, 62], 66, ["high school teacher", "primary teacher", "school principal", "school counsellor"]],
  ["Health & wellbeing", 6, [28, 60], 68, ["GP", "youth psychologist", "paediatric nurse", "mental health worker"]],
  ["Tech workers", 9, [24, 45], 38, ["software engineer", "product manager", "data scientist", "UX designer"]],
  ["Creators & gamers", 6, [18, 32], 22, ["content creator", "streamer", "esports player", "TikTok creator"]],
  ["Small business", 7, [28, 60], 48, ["cafe owner", "online shop owner", "tradie", "marketing consultant"]],
  ["Civil liberties & privacy", 5, [22, 60], 20, ["privacy advocate", "civil liberties lawyer", "digital rights volunteer"]],
  ["Retirees & grandparents", 9, [62, 82], 74, ["retired nurse", "grandparent", "retired engineer", "retired teacher"]],
  ["Journalists & commentators", 4, [26, 58], 50, ["journalist", "political commentator", "podcaster"]],
  ["Young professionals", 9, [23, 34], 45, ["accountant", "nurse", "sales rep", "public servant"]],
  ["Rural & regional", 4, [25, 70], 60, ["farmer", "regional teacher", "mine worker", "country GP"]],
] as const;

const REGIONS = [
  ["Sydney, NSW", 21], ["Melbourne, VIC", 20], ["Brisbane, QLD", 10], ["Perth, WA", 8], ["Adelaide, SA", 5],
  ["Gold Coast, QLD", 3], ["Newcastle, NSW", 2], ["Canberra, ACT", 2], ["Hobart, TAS", 1.5], ["Geelong, VIC", 1.5],
  ["Darwin, NT", 0.6], ["Regional NSW", 8], ["Regional VIC", 6], ["Regional QLD", 7], ["Regional WA", 2], ["Regional SA", 1.5],
] as const;

const INTERESTS = [
  "mental health", "parenting", "free speech", "privacy", "age verification", "big tech", "education",
  "online safety", "gaming", "AFL", "cricket", "small business", "politics", "tech policy", "cyberbullying",
  "creator economy", "civil liberties", "family", "youth culture", "news",
] as const;

const FIRST = [
  "Olivia", "Jack", "Charlotte", "Noah", "Mia", "Oliver", "Ava", "William", "Isla", "Leo", "Grace", "Lucas",
  "Chloe", "Thomas", "Zoe", "Liam", "Ruby", "Henry", "Sophie", "Ethan", "Priya", "Arjun", "Mei", "Wei",
  "Aisha", "Omar", "Hannah", "Ben", "Emily", "Josh", "Tahlia", "Riley", "Jasmine", "Kai", "Ngoc", "Minh",
  "Lachlan", "Matilda", "Harrison", "Georgia", "Sam", "Bella", "Daniel", "Lily", "Hamish", "Kirra", "Jarrah",
  "Fatima", "Ali", "Sofia", "Luca", "Maria", "Nikos", "Elena", "Anh", "Raj", "Sienna", "Cooper", "Evie",
] as const;
const LAST = [
  "Smith", "Jones", "Williams", "Brown", "Wilson", "Taylor", "Nguyen", "Johnson", "Martin", "White",
  "Anderson", "Walker", "Thompson", "Kelly", "Ryan", "Chen", "Singh", "Patel", "Wang", "Tran", "Murphy",
  "Lee", "Harris", "Clarke", "Papadopoulos", "Rossi", "Khan", "O'Brien", "Campbell", "Mitchell",
] as const;

type Draft = Omit<Persona, "bio"> & { id: string; handle: string; stance: number };

function draft(i: number): Draft {
  const seg = weighted(SEGMENTS.map((s) => [s, s[1]] as const));
  const [segment, , [minAge, maxAge], stanceMean, roles] = seg;
  const leaning = weighted([["left", 35], ["centre", 35], ["right", 30]] as const);
  const leanShift = leaning === "right" ? 5 : leaning === "left" ? -3 : 0;
  const first = pick(FIRST);
  const last = pick(LAST);
  const interests = new Set<string>();
  while (interests.size < 3) interests.add(pick(INTERESTS));
  const handle = `${first}${last}`.toLowerCase().replace(/[^a-z]/g, "").slice(0, 12) + "_" + (i % 97);
  return {
    id: `a${String(i).padStart(4, "0")}`,
    handle,
    name: `${first} ${last}`,
    age: Math.round(minAge + rand() * (maxAge - minAge)),
    region: weighted(REGIONS),
    role: pick(roles),
    segment,
    leaning,
    interests: [...interests],
    activity: Number(clamp(normal(0.45, 0.2), 0.05, 0.95).toFixed(2)),
    openness: Number(clamp(normal(0.4, 0.18), 0.05, 0.9).toFixed(2)),
    stance: Math.round(clamp(normal(stanceMean + leanShift, 15), 2, 98)),
  };
}

function templateBio(d: Draft) {
  return `${d.age}-year-old ${d.role} from ${d.region}. Into ${d.interests.join(", ")}.`;
}

const BioBatch = z.object({ bios: z.array(z.object({ id: z.string(), bio: z.string() })) });

async function llmBios(drafts: Draft[]): Promise<Map<string, string>> {
  const client = createClient();
  const out = new Map<string, string>();
  const batches: Draft[][] = [];
  for (let i = 0; i < drafts.length; i += 10) batches.push(drafts.slice(i, i + 10));
  let done = 0;
  await Promise.all(
    batches.map(async (batch) => {
      const list = batch
        .map((d) => `${d.id}: ${d.name}, ${d.age}, ${d.role}, ${d.region}, ${d.leaning}-leaning, interests: ${d.interests.join(", ")}, stance on the under-16 social media ban: ${d.stance}/100 support`)
        .join("\n");
      for (let attempt = 1; attempt <= 3; attempt++) try {
        const res = await client.messages.parse({
          model: config.agentModel,
          max_tokens: 8000,
          thinking: { type: "disabled" },
          messages: [
            {
              role: "user",
              content:
                "Write a one-sentence social media profile bio (max 25 words, first person, Australian English, " +
                "no hashtags) for each persona below. Make them feel like real, different people. Do not state the " +
                "stance number.\n\n" + list,
            },
          ],
          output_config: { format: zodOutputFormat(BioBatch) },
        });
        for (const b of res.parsed_output?.bios ?? []) out.set(b.id, b.bio);
        break;
      } catch (err) {
        if (attempt === 3) console.warn("\nbio batch failed 3 times, using templates:", (err as Error).message.slice(0, 120));
      }
      done += batch.length;
      process.stdout.write(`\rbios ${done}/${drafts.length}`);
    }),
  );
  process.stdout.write("\n");
  return out;
}

async function main() {
  const drafts = Array.from({ length: COUNT }, (_, i) => draft(i));
  const useLlm = !process.argv.includes("--no-llm") && hasLlmKey();
  // Keep bios already written by the model (drafts are deterministic, so ids match).
  const previous = new Map<string, string>();
  if (fs.existsSync(OUT)) {
    for (const a of JSON.parse(fs.readFileSync(OUT, "utf8")) as { id: string; persona: Persona }[]) {
      if (!/^\d+-year-old /.test(a.persona.bio)) previous.set(a.id, a.persona.bio);
    }
  }
  const missing = drafts.filter((d) => !previous.has(d.id));
  const fresh = useLlm && missing.length ? await llmBios(missing) : new Map<string, string>();
  const bios = new Map([...previous, ...fresh]);
  const agents = drafts.map(({ id, handle, stance, ...p }) => ({
    id,
    handle,
    stance,
    persona: { ...p, bio: bios.get(id) ?? templateBio({ id, handle, stance, ...p }) },
  }));
  fs.mkdirSync("data", { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(agents, null, 1));
  const avg = agents.reduce((s, a) => s + a.stance, 0) / agents.length;
  console.log(`wrote ${agents.length} agents to ${OUT} (llm bios: ${bios.size}, avg stance ${avg.toFixed(1)})`);
}

main();
