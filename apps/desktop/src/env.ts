import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createEnv } from "@t3-oss/env-core";
import { app } from "electron";
import z from "zod";
import { hmr } from "./util/hmr";

async function createEnv_() {
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
  // register effect (with cleanup)
  await hmr.runEffect(import.meta.url, () => {
    const original = USER_DATA_PATH;
    app.setPath("userData", join(USER_DATA_PATH, "Default"));

    return () => {
      // restore on cleanup
      app.setPath("userData", original);
    };
  });

  const constant = {
    USER_DATA_PATH,
    CACHE_PATH,
    //TODO: adjust for production path
    IPC_PRELOAD_PATH: join(
      import.meta.dirname,
      "../../../packages/preload/dist/_preload/ipc.js",
    ),
    CHROME_PRELOAD_PATH: join(
      import.meta.dirname,
      "../../../packages/preload/dist/_preload/chrome.js",
    ),
    RENDERER_PATH: join(import.meta.dirname, "../../../packages/renderer/dist"),
    RENDERER_URL: `http://localhost:${validatedEnv.RENDERER_PORT}`,
  };

  return {
    ...validatedEnv,
    ...constant,
  } as const;
}

export const env = await createEnv_();
