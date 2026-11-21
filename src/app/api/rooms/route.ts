import { NextResponse } from "next/server";
import { rules } from "@/engine/config";
import { isBlocked } from "@/engine/moderation";
import { createRoom } from "@/engine/runtime";
import type { RoomKind } from "@/engine/types";

export const dynamic = "force-dynamic";

const KINDS: RoomKind[] = ["product", "feature", "decision"];
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** Create a room (an idea under test) and start building its audience. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const title = str(body.title);
  const description = str(body.description);
  const region = str(body.region) || "Australia";
  const targetHint = str(body.targetHint);
  const kind = KINDS.includes(body.kind as RoomKind) ? (body.kind as RoomKind) : null;
  if (!title) return NextResponse.json({ error: "Give your idea a title" }, { status: 400 });
  if (!kind) return NextResponse.json({ error: "Pick product, feature or decision" }, { status: 400 });
  if (description.length < 20) return NextResponse.json({ error: "Describe the idea in a sentence or two" }, { status: 400 });
  if (title.length > rules.maxTitleChars) return NextResponse.json({ error: `Title: max ${rules.maxTitleChars} characters` }, { status: 400 });
  if (description.length > rules.maxDescriptionChars) return NextResponse.json({ error: `Description: max ${rules.maxDescriptionChars} characters` }, { status: 400 });
  if (region.length > 60 || targetHint.length > rules.maxTargetHintChars) return NextResponse.json({ error: "Region or target customer is too long" }, { status: 400 });
  if ([title, description, region, targetHint].some(isBlocked)) return NextResponse.json({ error: "Please keep it clean, it goes on the big screen" }, { status: 400 });
  try {
    const room = createRoom({ title, kind, description, region, targetHint });
    return NextResponse.json({ id: room.store.room.id });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 503 });
  }
}
