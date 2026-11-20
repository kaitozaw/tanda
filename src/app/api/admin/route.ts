import { NextResponse } from "next/server";
import { getStore } from "@/engine/store";
import { config } from "@/engine/config";
import { getEngine } from "@/engine/roundEngine";
import { reset } from "@/engine/runtime";
import { saveDirty } from "@/db/persist";

export const dynamic = "force-dynamic";

const authorised = (token: unknown) => !!config.adminToken && token === config.adminToken;

function status() {
  const store = getStore();
  const engine = getEngine();
  return {
    room: { ...store.room },
    idleReason: engine?.idleReason() ?? null,
    lastRound: engine?.lastSummary ?? null,
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
  switch (body.action) {
    case "pause":
      store.room.paused = true;
      break;
    case "resume":
      store.room.paused = false;
      break;
    case "reset":
      await reset();
      break;
    case "round":
      await getEngine()?.tick(); // run one round now (still respects pause / cap / pending posts)
      break;
    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
  store.markRoomDirty();
  await saveDirty(store);
  return NextResponse.json(status());
}
