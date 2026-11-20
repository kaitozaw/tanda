"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

type Node = { id: string; label: string; kind: string };
type Link = { source: string; target: string; kind: string };

const COLOR: Record<string, string> = {
  author: "#0f172a",
  like: "#94a3b8",
  reply: "#0ea5e9",
  repost: "#8b5cf6",
  follow: "#14b8a6",
  persuasion: "#10b981",
  backlash: "#f43f5e",
  unfollow: "#f43f5e",
  neutralShift: "#f59e0b",
};

export default function SpreadGraph({ roomId, postId, version }: { roomId: string; postId: string; version: number }) {
  const [data, setData] = useState<{ nodes: Node[]; links: Link[] } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(400);

  useEffect(() => {
    fetch(`/api/rooms/${roomId}/spread/${postId}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch(() => setData(null));
  }, [roomId, postId, version]);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={box} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      {data && data.nodes.length > 1 ? (
        <ForceGraph2D
          graphData={data}
          width={width}
          height={320}
          nodeLabel="label"
          nodeRelSize={4}
          nodeVal={(n) => ((n as Node).kind === "author" ? 6 : 1)}
          nodeColor={(n) => COLOR[(n as Node).kind] ?? "#94a3b8"}
          linkColor={(l) => ((l as Link).kind === "via-repost" ? "#8b5cf6" : "#cbd5e1")}
          cooldownTicks={80}
        />
      ) : (
        <div className="flex h-40 items-center justify-center text-sm text-slate-400">No spread yet</div>
      )}
      <div className="flex flex-wrap gap-3 border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
        {["author", "like", "reply", "repost", "persuasion", "backlash"].map((k) => (
          <span key={k} className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: COLOR[k] }} />
            {k}
          </span>
        ))}
        <span className="text-violet-600">purple links = spread via repost</span>
      </div>
    </div>
  );
}
