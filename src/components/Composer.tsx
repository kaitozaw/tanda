"use client";
import { useState } from "react";
import { Avatar } from "./ui";

const MAX = 280;

export default function Composer({ name, disabled, onPost }: { name: string; disabled?: string | null; onPost: (text: string) => Promise<void> }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await onPost(text);
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
          placeholder={disabled ?? "Pitch the idea in 280 characters"}
          disabled={!!disabled}
          className="w-full resize-none bg-transparent py-2 text-lg placeholder:text-muted outline-none sm:text-xl disabled:opacity-60"
        />
        <p className="pb-3 text-[13px] text-muted">Your pitch goes out with the idea card attached. Post several to compare them.</p>
        <div className="flex items-center justify-end gap-3 border-t border-line pt-3">
          {text.length > 0 && <span className={`text-sm tabular-nums ${left <= 20 ? "text-like" : "text-muted"}`}>{left}</span>}
          <button
            onClick={submit}
            disabled={busy || !text.trim() || !!disabled}
            className="rounded-full bg-accent px-5 py-2 font-bold sm:py-1.5 text-white transition hover:bg-accent-dim disabled:opacity-50"
          >
            {busy ? "Posting…" : "Pitch"}
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-like">{error}</p>}
      </div>
    </div>
  );
}
