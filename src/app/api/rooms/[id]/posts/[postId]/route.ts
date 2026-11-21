import { NextResponse } from "next/server";
import { getStore } from "@/engine/store";
import { eventView, pitchDetail } from "@/engine/views";

export const dynamic = "force-dynamic";

/**
 * One post: its replies (oldest first, opened in the timeline) and, for a pitch, its full public
 * results (scorecard, breakdown, feedback), opened from the Dashboard leaderboard.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string; postId: string }> }) {
  const { postId } = await params;
  const store = getStore();
  const post = store.posts.get(postId);
  if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });
  const replies = (store.eventsByPost.get(postId) ?? []).filter((e) => e.type === "reply").map((e) => eventView(store, e));
  return NextResponse.json({ replies, detail: post.authorType === "member" ? pitchDetail(store, post) : null });
}
