"use client";
import { useEffect, useState } from "react";

type Status = { rooms: { id: string; title: string; build: string; status: string; round: number; agents: number; members: number; pitches: number }[] } & Record<string, unknown>;

export default function Admin() {
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try { setToken(localStorage.getItem("adminToken") ?? ""); } catch {}
  }, []);

  async function load() {
    const res = await fetch(`/api/admin?token=${encodeURIComponent(token)}`, { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) return setError(data.error);
    setError(null);
    setStatus(data);
    try { localStorage.setItem("adminToken", token); } catch {}
  }

  async function act(roomId: string, action: string) {
    if (action === "reset" && !confirm("Delete this room's members, pitches and audience, then build a new audience?")) return;
    const res = await fetch("/api/admin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, action, roomId }) });
    const data = await res.json();
    if (!res.ok) return setError(data.error);
    setError(null);
    setStatus(data);
  }

  return (
    <main className="mx-auto max-w-3xl space-y-4 px-4 py-8">
      <h1 className="text-2xl font-bold">Admin</h1>
      <div className="flex gap-2">
        <input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Admin token" className="flex-1 rounded-md border border-line bg-transparent px-3 py-2 outline-none focus:border-accent" />
        <button onClick={load} className="rounded-full bg-accent px-4 py-2 font-bold text-white">Load</button>
      </div>
      {error && <p className="text-like">{error}</p>}
      {status?.rooms.map((r) => (
        <section key={r.id} className="rounded-2xl border border-line p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <a href={`/rooms/${r.id}`} className="font-bold text-accent hover:underline">{r.title}</a>
            <span className="text-[13px] text-muted">{r.id}</span>
          </div>
          <p className="mt-1 text-sm text-muted">
            {r.status} · build {r.build} · round {r.round} · {r.agents} agents · {r.members} people · {r.pitches} pitches
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {["pause", "resume", "round", "reset"].map((a) => (
              <button key={a} onClick={() => act(r.id, a)} className={`rounded-full border px-4 py-1.5 text-sm font-bold ${a === "reset" ? "border-like text-like" : "border-line"}`}>{a}</button>
            ))}
          </div>
        </section>
      ))}
      {status !== null && <pre className="overflow-x-auto rounded-2xl border border-line p-4 text-xs text-muted">{JSON.stringify(status, null, 2)}</pre>}
    </main>
  );
}
