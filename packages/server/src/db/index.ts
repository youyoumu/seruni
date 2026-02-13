import * as schema from "@repo/shared/db";
import { drizzle } from "drizzle-orm/libsql";

//TODO: from config
export const createDb = () => drizzle("file:db.sqlite", { schema });
export type DB = ReturnType<typeof createDb>;
