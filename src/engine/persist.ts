import pg from "pg";
import type { Snapshot, Store } from "./store";
import { config } from "./config";

// Each room is one jsonb row: simple, and small enough at hackathon scale.
let pool: pg.Pool | null = null;
const db = () =>
  (pool ??= new pg.Pool({
    connectionString: config.databaseUrl,
    ssl: config.databaseUrl.includes("render.com") ? { rejectUnauthorized: false } : undefined,
  }));

/** Every saved room in the current format. Rows from the old single-room build are skipped. */
export async function loadAll(): Promise<Snapshot[]> {
  if (!config.databaseUrl) return [];
  await db().query("CREATE TABLE IF NOT EXISTS snapshots (room_id text PRIMARY KEY, data jsonb NOT NULL, saved_at timestamptz NOT NULL DEFAULT now())");
  const { rows } = await db().query<{ data: Snapshot }>("SELECT data FROM snapshots ORDER BY saved_at");
  return rows.map((r) => r.data).filter((s) => typeof s.room?.title === "string" && typeof s.room?.step === "string");
}

const chains = new Map<string, Promise<void>>();
const timers = new Map<string, NodeJS.Timeout>();

/** Save now. Saves for one room run one at a time. */
export function save(store: Store): Promise<void> {
  const id = store.room.id;
  const prev = chains.get(id) ?? Promise.resolve();
  if (!config.databaseUrl) return prev;
  const next = prev
    .then(async () => {
      await db().query(
        "INSERT INTO snapshots (room_id, data) VALUES ($1, $2) ON CONFLICT (room_id) DO UPDATE SET data = excluded.data, saved_at = now()",
        [id, JSON.stringify(store.snapshot())],
      );
    })
    .catch((err) => console.error("save failed", id, err));
  chains.set(id, next);
  return next;
}

/** Save within a few seconds, batching bursts of joins and posts into one write. */
export function saveSoon(store: Store) {
  const id = store.room.id;
  if (timers.has(id)) return;
  timers.set(
    id,
    setTimeout(() => {
      timers.delete(id);
      void save(store);
    }, 3000),
  );
}
