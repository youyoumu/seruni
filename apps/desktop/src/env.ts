import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createEnv } from "@t3-oss/env-core";
import { app } from "electron";
import z from "zod";
import { log } from "./util/logger";

const envJson = (() => {
  if (app.isPackaged) return {};
  try {
    return JSON.parse(
      readFileSync(join(import.meta.dirname, "../env.json"), "utf-8"),
    );
  } catch {
    return {};
  }
})();

const validatedEnv = createEnv({
  server: {
    ROARR_LOG: z.boolean().default(true),
    //TODO: make this configurable
    RENDERER_PORT: z.number().default(3000),
    DEV: z.boolean().default(false),
  },
  runtimeEnv: envJson,
  emptyStringAsUndefined: true,
});

const USER_DATA_PATH = app.getPath("userData");
const CACHE_PATH = join(USER_DATA_PATH, "cache");
app.setPath("userData", join(USER_DATA_PATH, "Default"));

const constant = {
  USER_DATA_PATH,
  CACHE_PATH,
  //TODO: adjust for production path
  PRELOAD_PATH: join(
    import.meta.dirname,
    "../../../packages/preload/dist",
    "main.js",
  ),
  CHROME_PRELOAD_PATH: join(
    import.meta.dirname,
    "../../../packages/preload/dist",
    "chrome.js",
  ),
  RENDERER_PATH: join(import.meta.dirname, "../../../packages/renderer/dist"),
  RENDERER_URL: `http://localhost:${validatedEnv.RENDERER_PORT}`,
};

export const env = {
  ...validatedEnv,
  ...constant,
} as const;
