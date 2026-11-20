import Link from "next/link";
import { rules } from "@/engine/config";

const ROOMS = [
  { id: rules.roomId, topic: rules.topic, audience: "1,000 Australians: parents, teens, teachers, tech workers and more", enabled: true },
  { id: "ev-launch", topic: "EV launch in Australia", audience: "Car buyers and early adopters", enabled: false },
  { id: "four-day-week", topic: "The four-day work week", audience: "Workers and employers", enabled: false },
];

export default function Home() {
  return (
    <main className="mx-auto min-h-screen max-w-[600px] border-x border-line">
      <header className="border-b border-line px-4 py-8">
        <h1 className="text-3xl font-extrabold tracking-tight">Capture the Narrative</h1>
        <p className="mt-2 text-muted">
          Test your post on 1,000 AI agents before you publish. See one hour of social media engagement in one minute.
        </p>
      </header>
      <h2 className="px-4 pt-4 pb-2 text-xl font-extrabold">Rooms</h2>
      <ul>
        {ROOMS.map((r) => (
          <li key={r.id} className="border-b border-line">
            {r.enabled ? (
              <Link href={`/rooms/${r.id}`} className="block px-4 py-3 transition hover:bg-white/[0.03]">
                <div className="text-[13px] text-repost">● Live</div>
                <div className="font-bold">{r.topic}</div>
                <div className="text-sm text-muted">{r.audience}</div>
              </Link>
            ) : (
              <div className="px-4 py-3 opacity-50">
                <div className="text-[13px] text-muted">Coming soon</div>
                <div className="font-bold">{r.topic}</div>
                <div className="text-sm text-muted">{r.audience}</div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
