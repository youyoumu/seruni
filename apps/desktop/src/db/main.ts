import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { env } from "#/env";
import { log } from "#/util/logger";

hmr.log(import.meta);

const db = drizzle(`file:${env.DB_FILE_PATH}`);

//TODO: enum namespace
log.debug({ namespace: "DB" }, "Migrating database");
await migrate(db, {
  migrationsFolder: env.DRIZZLE_PATH,
});
