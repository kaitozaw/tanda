import { NextResponse } from "next/server";
import { getRoom } from "@/engine/store";
import { roomView } from "@/engine/views";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const room = getRoom(id);
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });
  const memberId = new URL(req.url).searchParams.get("member");
  return NextResponse.json(roomView(room, memberId));
}
