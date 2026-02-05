import { drizzle } from "drizzle-orm/libsql";

import * as schema from "./schema.ts";

//TODO: from config
export const db = drizzle("file:db.sqlite", { schema });
