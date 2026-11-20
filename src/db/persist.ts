import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { asc, sql } from "drizzle-orm";
import pg from "pg";
import * as schema from "./schema";
import type { Store } from "../engine/store";
import { config } from "../engine/config";

let db: NodePgDatabase<typeof schema> | null = null;

export function dbEnabled() {
  return !!config.databaseUrl;
}

function getDb() {
  if (!db) {
    const pool = new pg.Pool({
      connectionString: config.databaseUrl,
      ssl: config.databaseUrl.includes("render.com") ? { rejectUnauthorized: false } : undefined,
    });
    db = drizzle(pool, { schema });
  }
  return db;
}

/** Create tables if missing (keeps deploy to one step; drizzle-kit is still available for changes). */
export async function migrate() {
  if (!dbEnabled()) return;
  await getDb().execute(sql`
    CREATE TABLE IF NOT EXISTS rooms (id text PRIMARY KEY, data jsonb NOT NULL);
    CREATE TABLE IF NOT EXISTS agents (id text PRIMARY KEY, data jsonb NOT NULL);
    CREATE TABLE IF NOT EXISTS members (id text PRIMARY KEY, data jsonb NOT NULL);
    CREATE TABLE IF NOT EXISTS posts (id text PRIMARY KEY, seq integer NOT NULL, data jsonb NOT NULL);
    CREATE TABLE IF NOT EXISTS events (id integer PRIMARY KEY, post_id text NOT NULL, data jsonb NOT NULL);
    CREATE INDEX IF NOT EXISTS events_post_id ON events (post_id);
  `);
}

const chunk = <T,>(xs: T[], n = 500) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));
const upsertData = { data: sql`excluded.data` };

let saving: Promise<void> = Promise.resolve();

/** Save everything that changed since the last save, in one transaction. Calls are serialised. */
export function saveDirty(store: Store): Promise<void> {
  saving = saving.then(() => doSave(store)).catch((err) => console.error("saveDirty failed", err));
  return saving;
}

async function doSave(store: Store) {
  if (!dbEnabled()) {
    resetDirty(store);
    return;
  }
  const d = store.dirty;
  const agentRows = [...d.agents].map((id) => store.agents.get(id)).filter((x) => !!x).map((a) => ({ id: a.id, data: a }));
  const memberRows = [...d.members].map((id) => store.members.get(id)).filter((x) => !!x).map((m) => ({ id: m.id, data: m }));
  const postRows = [...d.posts]
    .map((id) => store.posts.get(id))
    .filter((x) => !!x)
    .map((p) => ({ id: p.id, seq: store.postOrder.indexOf(p.id), data: p }));
  const eventRows = d.events.map((e) => ({ id: e.id, postId: e.postId, data: e }));
  const saveRoom = d.room;
  resetDirty(store);

  await getDb().transaction(async (tx) => {
    if (saveRoom) {
      await tx.insert(schema.rooms).values({ id: store.room.id, data: { ...store.room, running: false } })
        .onConflictDoUpdate({ target: schema.rooms.id, set: upsertData });
    }
    for (const rows of chunk(agentRows)) await tx.insert(schema.agents).values(rows).onConflictDoUpdate({ target: schema.agents.id, set: upsertData });
    for (const rows of chunk(memberRows)) await tx.insert(schema.members).values(rows).onConflictDoUpdate({ target: schema.members.id, set: upsertData });
    for (const rows of chunk(postRows)) await tx.insert(schema.posts).values(rows).onConflictDoUpdate({ target: schema.posts.id, set: upsertData });
    for (const rows of chunk(eventRows)) await tx.insert(schema.events).values(rows).onConflictDoNothing();
  });
}

function resetDirty(store: Store) {
  store.dirty = { agents: new Set(), members: new Set(), posts: new Set(), events: [], room: false };
}

/** Load saved state into the store. Returns false if there is nothing saved yet. */
export async function load(store: Store): Promise<boolean> {
  if (!dbEnabled()) return false;
  const db = getDb();
  const [room] = await db.select().from(schema.rooms);
  if (!room) return false;
  store.room = { ...room.data, running: false };
  for (const a of await db.select().from(schema.agents)) store.agents.set(a.id, a.data);
  for (const m of await db.select().from(schema.members)) store.members.set(m.id, m.data);
  for (const p of await db.select().from(schema.posts).orderBy(asc(schema.posts.seq))) {
    // A post whose feedback was in flight when we stopped gets it again.
    store.posts.set(p.id, p.data);
    store.postOrder.push(p.id);
  }
  for (const e of await db.select().from(schema.events).orderBy(asc(schema.events.id))) {
    store.events.push(e.data);
    const list = store.eventsByPost.get(e.postId) ?? [];
    list.push(e.data);
    store.eventsByPost.set(e.postId, list);
    store.eventSeq = Math.max(store.eventSeq, e.data.id);
  }
  resetDirty(store);
  return true;
}

export async function wipe() {
  if (!dbEnabled()) return;
  await getDb().execute(sql`TRUNCATE rooms, agents, members, posts, events`);
}
