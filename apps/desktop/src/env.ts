import { createEnv } from "@t3-oss/env-core";
import z from "zod";
import "dotenv/config";
import { join } from "node:path";
import { app } from "electron";

const validatedEnv = createEnv({
  server: {
    ROARR_LOG: z.stringbool(),
    RENDERER_PORT: z
      .string()
      .default("3000")
      .transform((v) => parseInt(v)),
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
  RENDERER_URL: `http://localhost:${validatedEnv.RENDERER_PORT}`,
};

export const env = {
  ...validatedEnv,
  ...constant,
} as const;
