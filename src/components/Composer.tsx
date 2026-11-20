"use client";
import { useState } from "react";
import { Avatar, SIDE_LABEL } from "./ui";

const MAX = 280;

export default function Composer({ name, onPost }: { name: string; onPost: (text: string, side: string) => Promise<void> }) {
  const [text, setText] = useState("");
  const [side, setSide] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!side) return setError("Pick your side first");
    setBusy(true);
    setError(null);
    try {
      await onPost(text, side);
      setText("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const left = MAX - text.length;
  return (
    <div className="flex gap-3 border-b border-line px-4 py-3">
      <Avatar name={name} me />
      <div className="min-w-0 flex-1">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MAX))}
          rows={2}
          placeholder="What's your campaign message?"
          className="w-full resize-none bg-transparent py-2 text-xl placeholder:text-muted outline-none"
        />
        <div className="flex flex-wrap gap-2 pb-3">
          {(["for", "against", "neutral"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSide(s)}
              className={`rounded-full border px-3 py-1 text-sm font-bold transition ${side === s ? "border-accent bg-accent/10 text-accent" : "border-line text-muted hover:border-accent hover:text-accent"}`}
            >
              {SIDE_LABEL[s]}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-line pt-3">
          {text.length > 0 && <span className={`text-sm tabular-nums ${left <= 20 ? "text-like" : "text-muted"}`}>{left}</span>}
          <button
            onClick={submit}
            disabled={busy || !text.trim()}
            className="rounded-full bg-accent px-5 py-1.5 font-bold text-white transition hover:bg-accent-dim disabled:opacity-50"
          >
            {busy ? "Posting…" : "Post"}
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-like">{error}</p>}
      </div>
    </div>
  );
}
