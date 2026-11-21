import { NextResponse } from "next/server";
import { getRoom, sim } from "@/engine/store";
import { config } from "@/engine/config";
import { resetRoom } from "@/engine/runtime";
import { save } from "@/engine/persist";
import { activeRoomIds, roomStatus } from "@/engine/scheduler";

export const dynamic = "force-dynamic";

const authorised = (token: unknown) => !!config.adminToken && token === config.adminToken;

function status() {
  const active = activeRoomIds();
  return {
    rooms: [...sim.rooms.values()].map((r) => ({
      id: r.store.room.id,
      title: r.store.room.title,
      kind: r.store.room.kind,
      build: `${r.store.room.status} (${r.store.room.step})`,
      status: roomStatus(r, active),
      paused: r.store.room.paused,
      round: r.store.room.round,
      agents: r.store.agents.size,
      members: r.store.members.size,
      pitches: r.store.pitches().length,
      lastRound: r.engine.lastSummary,
    })),
    requestsToday: sim.requests,
    config: {
      agentCount: config.agentCount,
      agentModel: config.agentModel,
      feedbackModel: config.feedbackModel,
      fakeLlm: config.fakeLlm,
      roundMs: config.roundMs,
      concurrency: config.concurrency,
      maxActiveRooms: config.maxActiveRooms,
      maxRooms: config.maxRooms,
      dailyRequestCap: config.dailyRequestCap,
    },
  };
}

export async function GET(req: Request) {
  if (!authorised(new URL(req.url).searchParams.get("token"))) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  return NextResponse.json(status());
}

/** Per-room actions: pause, resume, round (run one now), reset (new audience). */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { token?: unknown; action?: unknown; roomId?: unknown };
  if (!authorised(body.token)) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const room = typeof body.roomId === "string" ? getRoom(body.roomId) : undefined;
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });
  try {
    if (body.action === "pause" || body.action === "resume") {
      room.store.room.paused = body.action === "pause";
      await save(room.store);
    } else if (body.action === "round") void room.engine.tick();
    else if (body.action === "reset") await resetRoom(room.store.room.id);
    else return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 409 });
  }
  return NextResponse.json(status());
}
