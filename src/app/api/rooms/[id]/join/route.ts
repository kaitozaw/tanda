import { NextResponse } from "next/server";
import { getStore } from "@/engine/store";
import { addMember } from "@/engine/seed";
import { isBlocked } from "@/engine/moderation";
import { saveDirty } from "@/db/persist";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const store = getStore();
  if (id !== store.room.id) return NextResponse.json({ error: "Room not found" }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as { nickname?: unknown };
  const nickname = typeof body.nickname === "string" ? body.nickname.trim().slice(0, 24) : "";
  if (!nickname) return NextResponse.json({ error: "Enter a nickname" }, { status: 400 });
  if (isBlocked(nickname)) return NextResponse.json({ error: "Please choose another nickname" }, { status: 400 });
  const member = addMember(store, nickname);
  await saveDirty(store);
  return NextResponse.json({ memberId: member.id, handle: member.handle });
}
