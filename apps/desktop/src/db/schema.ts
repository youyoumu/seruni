import { int, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const notesTable = sqliteTable("notesTable", {
  id: int().primaryKey({ autoIncrement: true }),
  nodeId: int().notNull(),
});
