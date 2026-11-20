"use client";
import { useEffect, useState } from "react";

export default function Admin() {
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<unknown>(null);
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

  async function act(action: string) {
    if (action === "reset" && !confirm("Delete all members, posts and events and re-seed agents?")) return;
    const res = await fetch("/api/admin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, action }) });
    const data = await res.json();
    if (!res.ok) return setError(data.error);
    setStatus(data);
  }

  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-8">
      <h1 className="text-2xl font-bold">Admin</h1>
      <div className="flex gap-2">
        <input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Admin token" className="flex-1 rounded-md border border-line bg-transparent px-3 py-2 outline-none focus:border-accent" />
        <button onClick={load} className="rounded-full bg-accent px-4 py-2 font-bold text-white">Load</button>
      </div>
      <div className="flex flex-wrap gap-2">
        {["pause", "resume", "reset"].map((a) => (
          <button key={a} onClick={() => act(a)} className={`rounded-full border px-4 py-2 font-bold ${a === "reset" ? "border-like text-like" : "border-line"}`}>{a}</button>
        ))}
      </div>
      {error && <p className="text-like">{error}</p>}
      {status !== null && <pre className="overflow-x-auto rounded-2xl border border-line p-4 text-xs text-muted">{JSON.stringify(status, null, 2)}</pre>}
    </main>
  );
}
