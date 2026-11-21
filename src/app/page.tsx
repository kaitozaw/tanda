import Link from "next/link";
import { MARKETS } from "@/engine/markets";

export default function Home() {
  return (
    <main className="mx-auto min-h-screen max-w-[600px] border-x border-line">
      <header className="border-b border-line px-4 py-8">
        <h1 className="text-3xl font-extrabold tracking-tight">Capture the Narrative</h1>
        <p className="mt-2 text-muted">
          Pitch your product to 1,000 AI people in a market before you spend a dollar on it. Customers, investors, industry,
          regulators and media react in one minute.
        </p>
      </header>
      <h2 className="px-4 pt-4 pb-2 text-xl font-extrabold">Markets</h2>
      <ul>
        {MARKETS.map((m) => (
          <li key={m.id} className="border-b border-line">
            {m.status === "open" ? (
              <Link href={`/rooms/${m.id}`} className="block px-4 py-3 transition hover:bg-white/[0.03]">
                <div className="text-[13px] text-repost">● Live</div>
                <div className="font-bold">{m.name}</div>
                <div className="text-sm text-muted">{m.tagline}</div>
              </Link>
            ) : (
              <div className="px-4 py-3 opacity-50" aria-disabled>
                <div className="text-[13px] text-muted">Coming soon</div>
                <div className="font-bold">{m.name}</div>
                <div className="text-sm text-muted">{m.tagline}</div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
