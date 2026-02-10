import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./drizzle",
  schema: "../shared/src/db/schema.ts",
  dialect: "sqlite",
  dbCredentials: {
    url: "db.sqlite",
  },
});
