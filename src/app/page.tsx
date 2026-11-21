"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const KINDS = [
  ["product", "Product", "A new product or startup idea"],
  ["feature", "Feature", "A feature for an existing product"],
  ["decision", "Decision", "A policy, pivot or pricing change"],
] as const;
const MAX_DESC = 600;

export default function Home() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<string>("product");
  const [description, setDescription] = useState("");
  const [region, setRegion] = useState("Australia");
  const [targetHint, setTargetHint] = useState("");
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, kind, description, region, targetHint }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not create the room");
      router.push(`/rooms/${data.id}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  function open(e: React.FormEvent) {
    e.preventDefault();
    const id = link.trim().replace(/\/+$/, "").split("/rooms/").pop()?.split(/[/?#]/)[0];
    if (id) router.push(`/rooms/${id}`);
  }

  const field = "w-full rounded-md border border-line bg-transparent px-3 py-2.5 outline-none focus:border-accent";
  return (
    <main className="mx-auto min-h-screen max-w-[600px] border-x border-line pb-16">
      <header className="border-b border-line px-4 py-8">
        <h1 className="text-3xl font-extrabold tracking-tight">Capture the Narrative</h1>
        <p className="mt-2 text-muted">
          Test your idea on 1,000 AI stakeholders before you spend a dollar on it. Customers, investors, industry and regulators react in one minute.
        </p>
      </header>

      <form onSubmit={create} className="space-y-4 px-4 py-6">
        <h2 className="text-xl font-extrabold">Test an idea</h2>
        <div>
          <label className="text-sm font-bold">Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} placeholder="Invoice reconciliation for freight companies" className={`mt-1 ${field}`} />
        </div>
        <div>
          <label className="text-sm font-bold">What is it?</label>
          <div className="mt-1 grid grid-cols-3 gap-2">
            {KINDS.map(([k, label, hint]) => (
              <button
                type="button"
                key={k}
                onClick={() => setKind(k)}
                className={`rounded-xl border px-3 py-2 text-left transition ${kind === k ? "border-accent bg-accent/10" : "border-line hover:border-accent"}`}
              >
                <div className={`font-bold ${kind === k ? "text-accent" : ""}`}>{label}</div>
                <div className="text-[12px] text-muted">{hint}</div>
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="flex justify-between text-sm">
            <label className="font-bold">Description</label>
            <span className={`tabular-nums ${MAX_DESC - description.length < 40 ? "text-like" : "text-muted"}`}>{MAX_DESC - description.length}</span>
          </div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, MAX_DESC))}
            rows={5}
            placeholder="The problem, the solution, who it is for, and the price if you know it."
            className={`mt-1 resize-none ${field}`}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-bold">Region</label>
            <input value={region} onChange={(e) => setRegion(e.target.value)} maxLength={60} className={`mt-1 ${field}`} />
          </div>
          <div>
            <label className="text-sm font-bold">Target customer <span className="font-normal text-muted">(optional)</span></label>
            <input value={targetHint} onChange={(e) => setTargetHint(e.target.value)} maxLength={120} placeholder="Ops managers at 50–200 person firms" className={`mt-1 ${field}`} />
          </div>
        </div>
        <p className="text-[13px] text-muted">Rooms are unlisted: only people with the link can join. Do not paste anything confidential.</p>
        <button disabled={busy || !title.trim() || description.trim().length < 20} className="w-full rounded-full bg-accent py-3 font-bold text-white transition hover:bg-accent-dim disabled:opacity-50">
          {busy ? "Creating…" : "Build my audience"}
        </button>
        {error && <p className="text-sm text-like">{error}</p>}
      </form>

      <form onSubmit={open} className="space-y-2 border-t border-line px-4 py-6">
        <h2 className="text-xl font-extrabold">Join a room</h2>
        <div className="flex gap-2">
          <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Paste a room link" className={`flex-1 ${field}`} />
          <button className="rounded-full border border-line px-4 font-bold transition hover:border-accent">Open</button>
        </div>
      </form>
    </main>
  );
}
