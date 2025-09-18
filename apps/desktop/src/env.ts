import { createEnv } from "@t3-oss/env-core";
import z from "zod";
import "dotenv/config";
import { join } from "node:path";
import { app } from "electron";

const validatedEnv = createEnv({
  server: {
    ROARR_LOG: z.stringbool(),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});

const constant = {
  USER_DATA_PATH: app.getPath("userData"),
  PRELOAD_PATH: join(
    import.meta.dirname,
    "../../../packages/preload/dist",
    "main.js",
  ),
  RENDERER_PATH: join(import.meta.dirname, "../../../packages/renderer/dist"),
  RENDERER_URL: `http://localhost:${3000}`,
};

export const env = {
  ...validatedEnv,
  ...constant,
} as const;
