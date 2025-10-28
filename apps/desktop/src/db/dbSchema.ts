import type { AnkiNote } from "@repo/preload/ipc";
import { int, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Notes table
export const notesTable = sqliteTable("notes", {
  id: int().primaryKey({ autoIncrement: true }),
  noteId: int().notNull().unique(),
  info: text({ mode: "json" }).$type<AnkiNote | null>().default(null),
});

// Media table (belongs to one note)
export const mediaTable = sqliteTable("media", {
  id: int().primaryKey({ autoIncrement: true }),
  noteId: int()
    .notNull()
    .references(() => notesTable.id, { onDelete: "cascade" }),
  fileName: text().notNull(),
  type: text({ enum: ["picture", "sentenceAudio"] }).notNull(),
  vadData: text({ mode: "json" })
    .$type<{ start: number; end: number }[] | null>()
    .default(null),
});
