import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

type AnkiNote = {
  cards: number[];
  fields: { [key: string]: { order: number; value: string } };
  mod: number;
  modelName: string;
  noteId: number;
  profile: string;
  tags: string[];
};

const id = () => integer().primaryKey({ autoIncrement: true });
const createdAt = () =>
  integer("created_at", { mode: "timestamp" })
    .default(sql`(unixepoch())`)
    .notNull();
const updatedAt = () =>
  integer("updated_at", { mode: "timestamp" })
    .default(sql`(unixepoch())`)
    .notNull()
    .$onUpdate(() => new Date());

export const session = sqliteTable("session", {
  id: id(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  name: text("name").notNull(),
});
export type Session = typeof session.$inferSelect;

export const textHistory = sqliteTable("text_history", {
  id: id(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  sessionId: integer("session_id")
    .notNull()
    .references(() => session.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
});
export type TextHistory = typeof textHistory.$inferSelect;

export const notes = sqliteTable("notes", {
  id: id(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  noteId: integer("note_id").notNull().unique(),
  info: text("info", { mode: "json" }).$type<AnkiNote | null>().default(null),
});
export type Note = typeof notes.$inferSelect;

export const media = sqliteTable("media", {
  id: id(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  noteId: integer("note_id")
    .notNull()
    .references(() => notes.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  type: text("type", { enum: ["picture", "sentenceAudio"] }).notNull(),
  vadData: text("vad_data", { mode: "json" })
    .$type<{ start: number; end: number }[] | null>()
    .default(null),
});
export type Media = typeof media.$inferSelect;
