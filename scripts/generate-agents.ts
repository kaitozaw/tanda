/**
 * Generates data/rooms/<market>/agents.json: 1,000 personas for one market (plan/PRODUCT.md → Audience).
 * Attributes come from the market's tables below. With ANTHROPIC_API_KEY set (and no --no-llm), Haiku
 * writes a short bio for each persona in batches; otherwise a template bio is used. Bios already
 * written by the model are kept on a re-run (drafts are deterministic, so ids match).
 *
 *   npm run agents:generate -- --market au            # rules + Haiku bios
 *   npm run agents:generate -- --market au --no-llm
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { createClient, hasLlmKey } from "../src/engine/llm";
import { config, rules } from "../src/engine/config";
import { getMarket } from "../src/engine/markets";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { POWER_TYPES, type AgentType, type Persona, type PowerType } from "../src/engine/types";

const COUNT = 1000;
const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

// Deterministic RNG so the file is reproducible.
let seed = 20261121;
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];
const sample = <T,>(xs: readonly T[], n: number) => [...xs].sort(() => rand() - 0.5).slice(0, n);
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
const trait = (mean: number, sd = 0.15) => Number(clamp(normal(mean, sd), 0.02, 0.98).toFixed(2));

// ---------------------------------------------------------------------------------------------
// Market tables
// ---------------------------------------------------------------------------------------------

/** Means (0-1) for adoption, price sensitivity and scepticism. */
type Traits = { adoption: number; price: number; scepticism: number };

interface Group extends Traits {
  name: string;
  /** Percent of the customer crowd. */
  share: number;
  ages: [number, number];
  roles: string[];
  painPoints: string[];
}

interface Archetype {
  name: string;
  role: string;
  priorities: string[];
  scepticism: number;
}

interface MarketTables {
  regions: (readonly [string, number])[];
  first: string[];
  last: string[];
  groups: Group[];
  archetypes: Record<PowerType, Archetype[]>;
}

const AU: MarketTables = {
  regions: [
    ["Sydney, NSW", 21], ["Melbourne, VIC", 20], ["Brisbane, QLD", 10], ["Perth, WA", 8], ["Adelaide, SA", 5],
    ["Gold Coast, QLD", 3], ["Newcastle, NSW", 2], ["Canberra, ACT", 2], ["Hobart, TAS", 1.5], ["Geelong, VIC", 1.5],
    ["Darwin, NT", 0.6], ["Regional NSW", 8], ["Regional VIC", 6], ["Regional QLD", 7], ["Regional WA", 2], ["Regional SA", 1.5],
  ],
  first: [
    "Olivia", "Jack", "Charlotte", "Noah", "Mia", "Oliver", "Ava", "William", "Isla", "Leo", "Grace", "Lucas",
    "Chloe", "Thomas", "Zoe", "Liam", "Ruby", "Henry", "Sophie", "Ethan", "Priya", "Arjun", "Mei", "Wei",
    "Aisha", "Omar", "Hannah", "Ben", "Emily", "Josh", "Tahlia", "Riley", "Jasmine", "Kai", "Ngoc", "Minh",
    "Lachlan", "Matilda", "Harrison", "Georgia", "Sam", "Bella", "Daniel", "Lily", "Hamish", "Kirra", "Jarrah",
    "Fatima", "Ali", "Sofia", "Luca", "Maria", "Nikos", "Elena", "Anh", "Raj", "Sienna", "Cooper", "Evie",
  ],
  last: [
    "Smith", "Jones", "Williams", "Brown", "Wilson", "Taylor", "Nguyen", "Johnson", "Martin", "White",
    "Anderson", "Walker", "Thompson", "Kelly", "Ryan", "Chen", "Singh", "Patel", "Wang", "Tran", "Murphy",
    "Lee", "Harris", "Clarke", "Papadopoulos", "Rossi", "Khan", "O'Brien", "Campbell", "Mitchell",
  ],
  groups: [
    {
      name: "Young professionals", share: 13, ages: [23, 34], adoption: 0.6, price: 0.55, scepticism: 0.4,
      roles: ["accountant", "nurse", "marketing coordinator", "junior lawyer", "public servant", "sales rep"],
      painPoints: ["rent eats half my pay", "no time after long work days", "saving for a house feels impossible", "too many subscriptions already"],
    },
    {
      name: "Families with kids", share: 15, ages: [30, 50], adoption: 0.4, price: 0.75, scepticism: 0.5,
      roles: ["parent of two primary schoolers", "working mum of a toddler", "dad of three", "single parent"],
      painPoints: ["grocery bills keep rising", "juggling school runs and work", "childcare costs", "screen time battles"],
    },
    {
      name: "Students", share: 8, ages: [18, 25], adoption: 0.7, price: 0.9, scepticism: 0.35,
      roles: ["uni student", "TAFE student", "international student", "postgrad researcher"],
      painPoints: ["living on a tight budget", "finding part-time work", "share house hassles", "textbook and transport costs"],
    },
    {
      name: "Retirees", share: 9, ages: [63, 82], adoption: 0.2, price: 0.7, scepticism: 0.65,
      roles: ["retired teacher", "retired nurse", "grandparent", "self-funded retiree"],
      painPoints: ["making super last", "health appointments and costs", "apps that are hard to use", "scams targeting older people"],
    },
    {
      name: "Small business owners", share: 10, ages: [28, 62], adoption: 0.45, price: 0.7, scepticism: 0.6,
      roles: ["cafe owner", "online shop owner", "hair salon owner", "physio clinic owner", "bookkeeper with her own practice"],
      painPoints: ["admin eats my evenings", "cash flow and late payments", "finding and keeping staff", "rising rent and energy costs"],
    },
    {
      name: "Tradies", share: 8, ages: [20, 60], adoption: 0.35, price: 0.65, scepticism: 0.6,
      roles: ["electrician", "plumber", "builder", "landscaper", "sparky running a two-person crew"],
      painPoints: ["chasing invoices", "quoting and paperwork after hours", "material costs", "scheduling jobs around weather"],
    },
    {
      name: "Corporate employees", share: 10, ages: [28, 55], adoption: 0.5, price: 0.45, scepticism: 0.5,
      roles: ["project manager at a bank", "HR business partner", "operations manager", "IT procurement lead", "finance analyst"],
      painPoints: ["too many tools that do not talk to each other", "slow approval processes", "hybrid work friction", "proving ROI to my boss"],
    },
    {
      name: "Regional Australians", share: 7, ages: [25, 70], adoption: 0.3, price: 0.7, scepticism: 0.6,
      roles: ["farmer", "regional GP", "mine worker", "country publican", "agricultural contractor"],
      painPoints: ["patchy internet and phone coverage", "long drives for basic services", "services built for city people", "freight costs"],
    },
    {
      name: "Tech early adopters", share: 5, ages: [22, 45], adoption: 0.9, price: 0.35, scepticism: 0.35,
      roles: ["software engineer", "product manager", "UX designer", "data scientist", "startup founder"],
      painPoints: ["clunky local apps", "wanting tools that just work", "privacy of my data", "paying for things that should be free"],
    },
    {
      name: "Sceptics", share: 15, ages: [30, 75], adoption: 0.1, price: 0.8, scepticism: 0.9,
      roles: ["long-time spreadsheet user", "cost-cutting finance manager", "retired engineer", "self-employed handyman"],
      painPoints: ["seen too many apps come and go", "do not trust new companies with my data", "happy with what I have", "hate another monthly fee"],
    },
  ],
  archetypes: {
    investor: [
      { name: "Seed angels", role: "Sydney-based seed angel, ex-founder", priorities: ["founder-market fit", "early traction", "a real pain point"], scepticism: 0.7 },
      { name: "Series A VCs", role: "Partner at a Melbourne Series A fund", priorities: ["market size beyond Australia", "defensibility", "unit economics"], scepticism: 0.8 },
      { name: "Impact investors", role: "Impact fund investment manager", priorities: ["measurable social outcome", "sustainable revenue"], scepticism: 0.65 },
      { name: "Corporate VC", role: "Venture lead at a big-four bank's investment arm", priorities: ["strategic fit with incumbents", "regulatory risk"], scepticism: 0.75 },
    ],
    industry_lead: [
      { name: "Incumbent execs", role: "Head of product at a major Australian retailer", priorities: ["protecting market share", "what customers ask for"], scepticism: 0.75 },
      { name: "Potential partners", role: "Partnerships lead at an Australian SaaS platform", priorities: ["integration value", "shared customers"], scepticism: 0.6 },
      { name: "Competitors", role: "Founder of a competing local startup", priorities: ["differentiation", "pricing pressure"], scepticism: 0.85 },
      { name: "Industry bodies", role: "Policy manager at an industry association", priorities: ["impact on members", "standards and compliance"], scepticism: 0.7 },
    ],
    regulator: [
      { name: "Consumer protection", role: "Policy officer at the consumer watchdog", priorities: ["misleading claims", "fair pricing", "subscription traps"], scepticism: 0.75 },
      { name: "Privacy", role: "Adviser at the privacy regulator", priorities: ["data collection", "consent", "security of personal data"], scepticism: 0.8 },
      { name: "Sector regulators", role: "Analyst at a financial services regulator", priorities: ["licensing", "consumer harm"], scepticism: 0.8 },
      { name: "Government policy", role: "Small business policy adviser in state government", priorities: ["jobs", "productivity", "regional access"], scepticism: 0.6 },
    ],
    media: [
      { name: "Tech press", role: "Startup reporter at an Australian tech news site", priorities: ["a fresh angle", "real customers", "local founders"], scepticism: 0.7 },
      { name: "Business press", role: "Small business columnist at a national paper", priorities: ["cost of living angle", "stories readers relate to"], scepticism: 0.65 },
      { name: "Creators", role: "Money-saving creator with a big TikTok following", priorities: ["something my audience can use today", "honest value"], scepticism: 0.5 },
      { name: "Community leads", role: "Organiser of a local founder community", priorities: ["local success stories", "helping members"], scepticism: 0.45 },
    ],
  },
};

const TABLES: Record<string, MarketTables> = { au: AU };

// ---------------------------------------------------------------------------------------------
// Drafts
// ---------------------------------------------------------------------------------------------

type Draft = Omit<Persona, "bio"> & { id: string; handle: string };
const HANDLE_TAG: Record<AgentType, string> = { customer: "", investor: "vc", industry_lead: "exec", regulator: "gov", media: "news" };

/** Agents per type for `count` agents: the PRODUCT.md mix scaled. */
function mixCounts(count: number): Record<AgentType, number> {
  const out = { customer: 0 } as Record<AgentType, number>;
  let power = 0;
  for (const t of POWER_TYPES) {
    out[t] = Math.round((rules.mix[t] * count) / 1000);
    power += out[t];
  }
  out.customer = count - power;
  return out;
}

function drafts(marketId: string, t: MarketTables): Draft[] {
  const counts = mixCounts(COUNT);
  const out: (Omit<Draft, "id" | "handle"> & { key: number })[] = [];
  const push = (type: AgentType, group: string, role: string, priorities: string[], ages: [number, number], tr: Traits, k: number, n: number) =>
    out.push({
      market: marketId,
      name: `${pick(t.first)} ${pick(t.last)}`,
      age: Math.round(ages[0] + rand() * (ages[1] - ages[0])),
      region: weighted(t.regions),
      tier: type === "customer" ? "crowd" : "power",
      type,
      role,
      group,
      priorities,
      adoption: trait(tr.adoption),
      priceSensitivity: trait(tr.price),
      scepticism: trait(tr.scepticism, 0.1),
      activity: type === "customer" ? trait(0.45, 0.2) : trait(0.5, 0.15),
      openness: type === "customer" ? trait(tr.scepticism > 0.8 ? 0.2 : 0.45, 0.15) : trait(0.35, 0.1),
      // Sort key so any prefix of the file keeps the mix (AGENT_COUNT takes a prefix): stratified
      // per power type, random for customers (so every group is spread through the file).
      key: type === "customer" ? rand() : (k + rand()) / n,
    });

  for (const type of POWER_TYPES) {
    const n = counts[type];
    for (let k = 0; k < n; k++) {
      const a = t.archetypes[type][k % t.archetypes[type].length];
      push(type, a.name, a.role, a.priorities, [30, 62], { adoption: 0.6, price: 0.3, scepticism: a.scepticism }, k, n);
    }
  }
  const n = counts.customer;
  let k = 0;
  for (const s of t.groups) {
    const m = Math.round((s.share / 100) * n);
    for (let j = 0; j < m && k < n; j++, k++) push("customer", s.name, pick(s.roles), sample(s.painPoints, 2 + Math.floor(rand() * 2)), s.ages, s, k, n);
  }
  // Rounding leftovers go to the first group.
  for (const s = t.groups[0]; k < n; k++) push("customer", s.name, pick(s.roles), sample(s.painPoints, 2), s.ages, s, k, n);

  return out
    .sort((a, b) => a.key - b.key)
    .map(({ key: _key, ...p }, i) => {
      const [first, last] = p.name.split(" ");
      const slug = (first + last).toLowerCase().replace(/[^a-z]/g, "").slice(0, 12);
      const handle = p.type === "customer" ? `${slug}_${i}` : `${HANDLE_TAG[p.type]}_${first.toLowerCase().replace(/[^a-z]/g, "")}${i}`;
      return { ...p, id: `a${String(i).padStart(4, "0")}`, handle };
    });
}

const templateBio = (d: Pick<Persona, "role" | "region" | "priorities">) =>
  `${d.role.charAt(0).toUpperCase()}${d.role.slice(1)} in ${d.region}. Thinking about ${d.priorities.slice(0, 2).join(" and ")}.`;

// ---------------------------------------------------------------------------------------------
// Bios
// ---------------------------------------------------------------------------------------------

const BioBatch = z.object({ bios: z.array(z.object({ id: z.string(), bio: z.string() })) });

async function llmBios(drafts: Draft[], summary: string): Promise<Map<string, string>> {
  const client = createClient();
  const out = new Map<string, string>();
  const batches: Draft[][] = [];
  for (let i = 0; i < drafts.length; i += 10) batches.push(drafts.slice(i, i + 10));
  let done = 0;
  await Promise.all(
    batches.map(async (batch) => {
      const list = batch
        .map((d) => `${d.id}: ${d.name}, ${d.age}, ${d.role}, ${d.region}; ${d.group}; thinking about: ${d.priorities.join(", ")}`)
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
                `The people below live and work in this market:\n<market>${summary}</market>\n\n` +
                "Write a one-sentence social media profile bio (max 25 words, first person, in the local voice, " +
                "no hashtags) for each persona. Make them feel like real, different people: vary tone, detail and quirks.\n\n" + list,
            },
          ],
          output_config: { format: zodOutputFormat(BioBatch) },
        });
        for (const b of res.parsed_output?.bios ?? []) out.set(b.id, b.bio.trim().slice(0, 200));
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
  const marketId = arg("market") ?? "au";
  const market = getMarket(marketId);
  const tables = TABLES[marketId];
  if (!market || !tables) throw new Error(`No tables for market "${marketId}"`);
  const out = path.join("data/rooms", marketId, "agents.json");

  const ds = drafts(marketId, tables);
  const useLlm = !process.argv.includes("--no-llm") && hasLlmKey();
  const previous = new Map<string, string>();
  if (fs.existsSync(out)) {
    const byId = new Map(ds.map((d) => [d.id, d]));
    for (const a of JSON.parse(fs.readFileSync(out, "utf8")) as { id: string; persona: Persona }[]) {
      const d = byId.get(a.id);
      // Keep a model-written bio only if the persona is unchanged and the bio is not the template.
      if (d && d.role === a.persona.role && d.group === a.persona.group && a.persona.bio !== templateBio(a.persona)) previous.set(a.id, a.persona.bio);
    }
  }
  const missing = ds.filter((d) => !previous.has(d.id));
  const fresh = useLlm && missing.length ? await llmBios(missing, market.summary) : new Map<string, string>();
  const bios = new Map([...previous, ...fresh]);
  const agents = ds.map(({ id, handle, ...p }) => ({ id, handle, persona: { ...p, bio: bios.get(id) ?? templateBio(p) } }));

  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(agents, null, 1));
  const counts = new Map<string, number>();
  for (const a of agents) counts.set(a.persona.type, (counts.get(a.persona.type) ?? 0) + 1);
  const byType = [...counts].map(([t, n]) => `${t} ${n}`).join(", ");
  console.log(`wrote ${agents.length} agents to ${out} (${byType}; llm bios: ${bios.size})`);
}

main();
