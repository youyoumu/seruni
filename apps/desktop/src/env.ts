import "#/util/hmr";
import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { createEnv } from "@t3-oss/env-core";
import { format } from "date-fns";
import { detect } from "detect-port";
import { app } from "electron";
import z from "zod";
import { log } from "./util/logger";

async function preferPort(preferredPort: number) {
  try {
    const realPort = await detect(preferredPort);
    if (realPort !== preferredPort) {
      log.debug(
        `Port ${preferredPort} was occupied, switching to port ${realPort}`,
      );
    }
    return realPort;
  } catch (e) {
    if (e instanceof Error) {
      log.error(`Failed to detect port: ${e.message}`);
    }
    return preferredPort;
  }
}

const HTTP_SERVER_PORT = await preferPort(42424);
const ANKI_CONNECT_PROXY_PORT = await preferPort(48765);

async function createEnv_() {
  const envJson = async () => {
    if (app.isPackaged || process.env.NODE_ENV === "production") return {};
    try {
      return JSON.parse(
        await readFile(join(import.meta.dirname, "../env.json"), "utf-8"),
      );
    } catch {
      return {};
    }
  };

  const validatedEnv = createEnv({
    server: {
      RENDERER_PORT: z.number().default(HTTP_SERVER_PORT),
      DEV: z.boolean().default(false),
      WS_PORT: z.number().default(45626),
    },
    runtimeEnv: await envJson(),
    emptyStringAsUndefined: true,
  });
  const DEV = validatedEnv.DEV;

  if (DEV) {
    // use separate user data dir for dev
    app.setPath("userData", join(import.meta.dirname, "../.userData"));
  }

  const USER_DATA_PATH = app.getPath("userData");
  const LOG_PATH = join(USER_DATA_PATH, "log");
  const LOG_FILE_NAME = `${format(new Date(), "yyyyMMdd_HHmmss_SSS_xxxx")}.jsonl`;
  const LOG_FILE_PATH = join(LOG_PATH, LOG_FILE_NAME);
  const DB_PATH = join(USER_DATA_PATH, "db");
  const DB_FILE_PATH = join(DB_PATH, "db.sqlite");
  const STORAGE_PATH = join(USER_DATA_PATH, "storage");
  const CACHE_PATH = join(USER_DATA_PATH, "cache");
  const CACHE_FILE_PATH = join(CACHE_PATH, "cache.json");
  const TEMP_PATH = join(USER_DATA_PATH, "temp");
  const EXTENSION_PATH = join(USER_DATA_PATH, "extension");
  const BIN_PATH = join(USER_DATA_PATH, "bin");
  const PYTHON_VENV_PATH = join(USER_DATA_PATH, "python");

  await mkdir(LOG_PATH, { recursive: true });
  await mkdir(DB_PATH, { recursive: true });
  await mkdir(STORAGE_PATH, { recursive: true });
  await mkdir(CACHE_PATH, { recursive: true });
  await mkdir(TEMP_PATH, { recursive: true });
  await mkdir(EXTENSION_PATH, { recursive: true });
  await mkdir(BIN_PATH, { recursive: true });
  await mkdir(PYTHON_VENV_PATH, { recursive: true });

  const DRIZZLE_PATH = join(import.meta.dirname, "drizzle");
  const DRIZZLE_PATH_DEV = join(import.meta.dirname, "../drizzle");

  const PYTHON_BIN_PATH_MAP: Partial<Record<NodeJS.Platform, string>> = {
    win32: join(BIN_PATH, "python/python.exe"),
    linux: join(BIN_PATH, "python/bin/python"),
  };
  const PYTHON_BIN_PATH = PYTHON_BIN_PATH_MAP[process.platform];
  if (!PYTHON_BIN_PATH) {
    throw new Error(
      `No python bin path found for platform ${process.platform}`,
    );
  }
  const PYTHON_PROJECT_PATH = join(import.meta.dirname, "python");
  const PYTHON_PROJECT_PATH_DEV = join(
    import.meta.dirname,
    "../../../packages/python",
  );
  const PYTHON_ENTRY_PATH = join(import.meta.dirname, "python/src/main.py");
  const PYTHON_ENTRY_PATH_DEV = join(
    import.meta.dirname,
    "../../../packages/python/src/main.py",
  );

  const IPC_PRELOAD_PATH = join(import.meta.dirname, "_preload/ipc.js");
  const IPC_PRELOAD_PATH_DEV = join(
    import.meta.dirname,
    "../../../packages/preload/dist/_preload/ipc.js",
  );
  const CHROME_PRELOAD_PATH = join(import.meta.dirname, "_preload/chrome.js");
  const CHROME_PRELOAD_PATH_DEV = join(
    import.meta.dirname,
    "../../../packages/preload/dist/_preload/chrome.js",
  );
  const RENDERER_PATH = join(import.meta.dirname, "renderer");
  const RENDERER_PATH_DEV = join(
    import.meta.dirname,
    "../../../packages/renderer/dist",
  );

  // separate chromium stuff from user data
  app.setPath("userData", join(USER_DATA_PATH, "Default"));

  const constant = {
    APP_NAME: "Seruni",
    USER_DATA_PATH,
    ELECTRON_PATH: app.getPath("userData"),
    EXTENSION_PATH,
    BIN_PATH,
    DB_PATH,
    DB_FILE_PATH,
    STORAGE_PATH,
    LOG_PATH,
    LOG_FILE_PATH,
    CACHE_PATH,
    CACHE_FILE_PATH,
    TEMP_PATH,

    DRIZZLE_PATH: DEV ? DRIZZLE_PATH_DEV : DRIZZLE_PATH,

    PYTHON_BIN_PATH,
    PYTHON_VENV_PATH,
    PYTHON_ENTRY_PATH: DEV ? PYTHON_ENTRY_PATH_DEV : PYTHON_ENTRY_PATH,
    PYTHON_PROJECT_PATH: DEV ? PYTHON_PROJECT_PATH_DEV : PYTHON_PROJECT_PATH,

    IPC_PRELOAD_PATH: DEV ? IPC_PRELOAD_PATH_DEV : IPC_PRELOAD_PATH,
    CHROME_PRELOAD_PATH: DEV ? CHROME_PRELOAD_PATH_DEV : CHROME_PRELOAD_PATH,
    RENDERER_PATH: DEV ? RENDERER_PATH_DEV : RENDERER_PATH,
    RENDERER_URL: `http://localhost:${validatedEnv.RENDERER_PORT}`,
    HTTP_SERVER_PORT,
    HTTP_SERVER_URL: `http://localhost:${HTTP_SERVER_PORT}`,
    ANKI_CONNECT_PROXY_PORT,
  };

  return {
    ...validatedEnv,
    ...constant,
  } as const;
}

export const env = await createEnv_();
export type Env = typeof env;
