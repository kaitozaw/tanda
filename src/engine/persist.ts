import pg from "pg";
import type { Snapshot, Store } from "./store";
import { config } from "./config";

// The whole room is one jsonb row: simple, and small enough at hackathon scale.
let pool: pg.Pool | null = null;
const db = () =>
  (pool ??= new pg.Pool({
    connectionString: config.databaseUrl,
    ssl: config.databaseUrl.includes("render.com") ? { rejectUnauthorized: false } : undefined,
  }));

/** Load the saved room into the store. Returns false if there is no database or nothing saved. */
export async function load(store: Store): Promise<boolean> {
  if (!config.databaseUrl) return false;
  await db().query("CREATE TABLE IF NOT EXISTS snapshots (room_id text PRIMARY KEY, data jsonb NOT NULL, saved_at timestamptz NOT NULL DEFAULT now())");
  const { rows } = await db().query<{ data: Snapshot }>("SELECT data FROM snapshots WHERE room_id = $1", [store.room.id]);
  if (!rows[0]) return false;
  store.restore(rows[0].data);
  return true;
}

let saving: Promise<void> = Promise.resolve();
let timer: NodeJS.Timeout | null = null;

/** Save now. Saves run one at a time. */
export function save(store: Store): Promise<void> {
  if (!config.databaseUrl) return saving;
  saving = saving
    .then(async () => {
      await db().query(
        "INSERT INTO snapshots (room_id, data) VALUES ($1, $2) ON CONFLICT (room_id) DO UPDATE SET data = excluded.data, saved_at = now()",
        [store.room.id, JSON.stringify(store.snapshot())],
      );
    })
    .catch((err) => console.error("save failed", err));
  return saving;
}

/** Save within a few seconds, batching bursts of joins and posts into one write. */
export function saveSoon(store: Store) {
  timer ??= setTimeout(() => {
    timer = null;
    void save(store);
  }, 3000);
}
