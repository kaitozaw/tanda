import { NextResponse } from "next/server";
import { getStore } from "@/engine/store";
import { spreadView } from "@/engine/views";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; postId: string }> }) {
  const { postId } = await params;
  const view = spreadView(getStore(), postId);
  if (!view) return NextResponse.json({ error: "Post not found" }, { status: 404 });
  return NextResponse.json(view);
}
