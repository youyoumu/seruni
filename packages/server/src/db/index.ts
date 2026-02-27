import type { State } from "#/state/state";
import * as schema from "@repo/shared/db";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

export const createDb = (state: State) => {
  const sqlite = new Database(state.path().db);
  return drizzle(sqlite, { schema });
};
export type DB = ReturnType<typeof createDb>;
