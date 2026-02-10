import { drizzle } from "drizzle-orm/libsql";

import * as schema from "@repo/shared/db";

//TODO: from config
export const createDb = () => drizzle("file:db.sqlite", { schema });
export type DB = ReturnType<typeof createDb>;
