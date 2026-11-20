import { integer, jsonb, pgTable, text } from "drizzle-orm/pg-core";
import type { Agent, Member, Post, RoomState, SimEvent } from "../engine/types";

// Document-style tables: the engine owns the shapes (src/engine/types.ts), Postgres keeps them safe.
export const rooms = pgTable("rooms", { id: text("id").primaryKey(), data: jsonb("data").$type<RoomState>().notNull() });
export const agents = pgTable("agents", { id: text("id").primaryKey(), data: jsonb("data").$type<Agent>().notNull() });
export const members = pgTable("members", { id: text("id").primaryKey(), data: jsonb("data").$type<Member>().notNull() });
export const posts = pgTable("posts", {
  id: text("id").primaryKey(),
  seq: integer("seq").notNull(),
  data: jsonb("data").$type<Post>().notNull(),
});
export const events = pgTable("events", {
  id: integer("id").primaryKey(),
  postId: text("post_id").notNull(),
  data: jsonb("data").$type<SimEvent>().notNull(),
});
