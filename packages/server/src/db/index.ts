import type { State } from "#/state/state";
import * as schema from "@repo/shared/db";
import { drizzle } from "drizzle-orm/libsql";

export const createDb = (state: State) => {
  return drizzle(`file:${state.path().db}`, { schema });
};
export type DB = ReturnType<typeof createDb>;
