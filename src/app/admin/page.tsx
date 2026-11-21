"use client";
import { useEffect, useState } from "react";

export default function Admin() {
  const [status, setStatus] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/admin", { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) return setError(data.error);
    setError(null);
    setStatus(data);
  }

  useEffect(() => {
    void load();
  }, []);

  async function act(action: string) {
    if (action === "reset" && !confirm("Delete all members, posts and events and re-seed the room?")) return;
    const res = await fetch("/api/admin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) });
    const data = await res.json();
    if (!res.ok) return setError(data.error);
    setError(null);
    setStatus(data);
  }

  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-8">
      <h1 className="text-2xl font-bold">Admin</h1>
      <div className="flex flex-wrap gap-2">
        <button onClick={load} className="rounded-full bg-accent px-4 py-2 font-bold text-white">refresh</button>
        {["pause", "resume", "reset"].map((a) => (
          <button key={a} onClick={() => act(a)} className={`rounded-full border px-4 py-2 font-bold ${a === "reset" ? "border-like text-like" : "border-line"}`}>{a}</button>
        ))}
      </div>
      {error && <p className="text-like">{error}</p>}
      {status !== null && <pre className="overflow-x-auto rounded-2xl border border-line p-4 text-xs text-muted">{JSON.stringify(status, null, 2)}</pre>}
    </main>
  );
}
