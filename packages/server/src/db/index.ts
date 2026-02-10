import { drizzle } from "drizzle-orm/libsql";

import * as schema from "@repo/shared/db";

//TODO: from config
export const db = drizzle("file:db.sqlite", { schema });
