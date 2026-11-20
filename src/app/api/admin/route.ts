import { NextResponse } from "next/server";
import { getStore, sim } from "@/engine/store";
import { config } from "@/engine/config";
import { reset } from "@/engine/runtime";
import { save } from "@/engine/persist";

export const dynamic = "force-dynamic";

const authorised = (token: unknown) => !!config.adminToken && token === config.adminToken;

function status() {
  const store = getStore();
  return {
    room: store.room,
    idleReason: sim.engine?.idleReason() ?? null,
    lastRound: sim.engine?.lastSummary ?? null,
    config: {
      agentCount: store.activeAgents().length,
      model: config.agentModel,
      fakeLlm: config.fakeLlm,
      roundMs: config.roundMs,
      concurrency: config.concurrency,
      dailyRequestCap: config.dailyRequestCap,
    },
  };
}

export async function GET(req: Request) {
  if (!authorised(new URL(req.url).searchParams.get("token"))) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  return NextResponse.json(status());
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { token?: unknown; action?: unknown };
  if (!authorised(body.token)) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const store = getStore();
  if (body.action === "pause" || body.action === "resume") store.room.paused = body.action === "pause";
  else if (body.action === "reset") await reset();
  else return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  await save(store);
  return NextResponse.json(status());
}
