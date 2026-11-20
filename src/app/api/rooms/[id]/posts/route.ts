import { NextResponse } from "next/server";
import { getStore, emptyCounts } from "@/engine/store";
import { rules } from "@/engine/config";
import { isBlocked } from "@/engine/moderation";
import { broadcastRefresh } from "@/engine/broadcaster";
import { saveSoon } from "@/engine/persist";
import type { Side } from "@/engine/types";

export const dynamic = "force-dynamic";

const SIDES: Side[] = ["for", "against", "neutral"];

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const store = getStore();
  if (id !== store.room.id) return NextResponse.json({ error: "Room not found" }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as { memberId?: unknown; text?: unknown; side?: unknown };
  const member = typeof body.memberId === "string" ? store.members.get(body.memberId) : undefined;
  if (!member) return NextResponse.json({ error: "Join the room first" }, { status: 401 });
  const text = typeof body.text === "string" ? body.text.trim() : "";
  const side = SIDES.includes(body.side as Side) ? (body.side as Side) : null;
  if (!side) return NextResponse.json({ error: "Pick a side" }, { status: 400 });
  if (!text) return NextResponse.json({ error: "Write something first" }, { status: 400 });
  if (text.length > rules.maxPostChars) return NextResponse.json({ error: `Max ${rules.maxPostChars} characters` }, { status: 400 });
  if (isBlocked(text)) return NextResponse.json({ error: "Please keep it clean, it goes on the big screen" }, { status: 400 });
  const wait = member.lastPostAt + rules.postCooldownMs - Date.now();
  if (wait > 0) return NextResponse.json({ error: `Wait ${Math.ceil(wait / 1000)}s before posting again` }, { status: 429 });

  member.lastPostAt = Date.now();
  const postId = `h${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
  store.addPost({
    id: postId,
    authorType: "member",
    authorId: member.id,
    text,
    side,
    createdAt: Date.now(),
    createdRound: store.room.round,
    roundsSeen: 0,
    counts: emptyCounts(),
    points: 0,
    finalized: false,
    feedback: null,
    feedbackStatus: "none",
  });
  saveSoon(store);
  broadcastRefresh(store.room.id);
  return NextResponse.json({ postId });
}
