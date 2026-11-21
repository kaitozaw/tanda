import { NextResponse } from "next/server";
import { sim } from "@/engine/store";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ ok: true, rooms: sim.rooms.size });
}
