import Link from "next/link";
import { rules } from "@/engine/config";

const ROOMS = [
  { id: rules.roomId, topic: rules.topic, audience: "1,000 Australians: parents, teens, teachers, tech workers and more", enabled: true },
  { id: "ev-launch", topic: "EV launch in Australia", audience: "Car buyers and early adopters", enabled: false },
  { id: "four-day-week", topic: "The four-day work week", audience: "Workers and employers", enabled: false },
];

export default function Home() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Pre-Post</h1>
      <p className="mt-2 text-slate-600">
        Test your post on 1,000 AI agents before you publish. See one hour of social media engagement in one minute.
      </p>
      <h2 className="mt-8 mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Rooms</h2>
      <ul className="space-y-3">
        {ROOMS.map((r) => (
          <li key={r.id}>
            {r.enabled ? (
              <Link href={`/rooms/${r.id}`} className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-400">
                <div className="font-semibold">{r.topic}</div>
                <div className="mt-1 text-sm text-slate-500">{r.audience}</div>
              </Link>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 p-4 text-slate-400">
                <div className="font-semibold">{r.topic}</div>
                <div className="mt-1 text-sm">Coming soon</div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
