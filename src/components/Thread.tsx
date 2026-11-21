"use client";
import { useEffect, useState } from "react";
import type { EventView, PostView, RoomView } from "@/engine/views";
import { Avatar, PostCard } from "./ui";

/** A timeline post that opens to show its replies. Replies refetch every round while open. */
export default function Thread(props: { roomId: string; round: number; post: PostView; room: RoomView["room"]; mine?: boolean }) {
  const { roomId, round, post } = props;
  const [open, setOpen] = useState(false);
  const [replies, setReplies] = useState<EventView[] | null>(null);

  useEffect(() => {
    if (!open) return;
    fetch(`/api/rooms/${roomId}/posts/${post.id}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { replies: [] }))
      .then((d: { replies: EventView[] }) => setReplies(d.replies))
      .catch(() => setReplies([]));
  }, [open, roomId, post.id, round]);

  return (
    <div className={open ? "border-b border-line" : ""}>
      <div onClick={() => setOpen((o) => !o)} className="cursor-pointer">
        <PostCard post={post} roundsToFinal={props.room.roundsToFinal} mine={props.mine} room={props.room} />
      </div>
      {open && (
        <div className="bg-card/40">
          {replies === null && <p className="px-4 py-3 text-sm text-muted">Loading replies…</p>}
          {replies?.length === 0 && <p className="px-4 py-3 text-sm text-muted">No replies yet</p>}
          {replies?.map((r) => (
            <div key={r.id} className="flex gap-3 border-t border-line py-3 pr-4 pl-10">
              <Avatar name={r.name || r.handle} size={32} />
              <div className="min-w-0 text-[15px]">
                <div className="flex flex-wrap gap-x-1.5">
                  <span className="font-bold">{r.name}</span>
                  <span className="truncate text-muted">@{r.handle} · {r.role}</span>
                </div>
                <p className="mt-0.5 break-words leading-5">{r.text}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
