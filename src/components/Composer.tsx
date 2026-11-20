"use client";
import { useEffect, useState } from "react";
import { SIDE_LABEL, SIDE_STYLE } from "./ui";

const MAX = 280;

export default function Composer({ cooldownMs, onPost }: { cooldownMs: number; onPost: (text: string, side: string) => Promise<void> }) {
  const [text, setText] = useState("");
  const [side, setSide] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wait, setWait] = useState(0);

  useEffect(() => setWait(Math.ceil(cooldownMs / 1000)), [cooldownMs]);
  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  async function submit() {
    if (!side) return setError("Pick your side first");
    setBusy(true);
    setError(null);
    try {
      await onPost(text, side);
      setText("");
      setWait(10);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex flex-wrap gap-2">
        {(["for", "against", "neutral"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSide(s)}
            className={`rounded-full px-3 py-1 text-sm font-medium transition ${side === s ? SIDE_STYLE[s] + " ring-2 ring-offset-1 ring-slate-400" : "bg-slate-100 text-slate-600"}`}
          >
            {SIDE_LABEL[s]}
          </button>
        ))}
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, MAX))}
        rows={3}
        placeholder="Write your campaign post…"
        className="w-full resize-none rounded-lg border border-slate-200 p-3 outline-none focus:border-slate-400"
      />
      <div className="mt-2 flex items-center justify-between">
        <span className={`text-xs ${text.length > MAX - 20 ? "text-rose-600" : "text-slate-400"}`}>{text.length}/{MAX}</span>
        <button
          onClick={submit}
          disabled={busy || wait > 0 || !text.trim()}
          className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          {wait > 0 ? `Wait ${wait}s` : busy ? "Posting…" : "Post"}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
    </div>
  );
}
