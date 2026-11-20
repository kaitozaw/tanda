import { NextResponse } from "next/server";
import { getStore } from "@/engine/store";
import { eventView } from "@/engine/views";

export const dynamic = "force-dynamic";

/** Replies to one post, oldest first. Fetched when a post is opened in the timeline. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string; postId: string }> }) {
  const { postId } = await params;
  const store = getStore();
  if (!store.posts.has(postId)) return NextResponse.json({ error: "Post not found" }, { status: 404 });
  const replies = (store.eventsByPost.get(postId) ?? []).filter((e) => e.type === "reply").map((e) => eventView(store, e));
  return NextResponse.json({ replies });
}
