import "#/util/hmr";
import { readFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { createEnv } from "@t3-oss/env-core";
import { app } from "electron";
import z from "zod";

hmr.log(import.meta);

async function createEnv_() {
  const envJson = (() => {
    if (app.isPackaged || process.env.NODE_ENV === "production") return {};
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
      RENDERER_PORT: z.number().default(56435),
      DEV: z.boolean().default(false),
      WS_PORT: z.number().default(45626),
    },
    runtimeEnv: envJson,
    emptyStringAsUndefined: true,
  });
  const DEV = validatedEnv.DEV;

  if (DEV) {
    await hmr.runEffect(import.meta.url, () => {
      const original = app.getPath("userData");
      app.setPath("userData", join(import.meta.dirname, "../.userData"));
      return () => {
        app.setPath("userData", original);
      };
    });
  }

  const USER_DATA_PATH = app.getPath("userData");
  const CACHE_PATH = join(USER_DATA_PATH, "cache");
  const TEMP_PATH = join(USER_DATA_PATH, "temp");
  const PYTHON_EXTRACT_PATH = join(USER_DATA_PATH, "python");

  await mkdir(CACHE_PATH, { recursive: true });
  await mkdir(TEMP_PATH, { recursive: true });
  await mkdir(PYTHON_EXTRACT_PATH, { recursive: true });

  const pythonBinPathMap: Partial<Record<NodeJS.Platform, string>> = {
    win32: join(PYTHON_EXTRACT_PATH, "python/python.exe"),
    linux: join(PYTHON_EXTRACT_PATH, "python/bin/python"),
  };
  const PYTHON_BIN_PATH = pythonBinPathMap[process.platform];
  if (!PYTHON_BIN_PATH) {
    throw new Error(
      `No python bin path found for platform ${process.platform}`,
    );
  }
  const PYTHON_BIN_PATH_DEV = join(
    import.meta.dirname,
    "../../../packages/python/.venv/bin/python",
  );
  const PYTHON_BIN_PATH_DEV2 = PYTHON_BIN_PATH;

  const PYTHON_ENTRY_PATH = join(import.meta.dirname, "python/src/main.py");
  const PYTHON_ENTRY_PATH_DEV = join(
    import.meta.dirname,
    "../../../packages/python/src/main.py",
  );
  const PYTHON_PACKAGE_PATH = join(import.meta.dirname, "python");
  const PYTHON_PACKAGE_PATH_DEV = join(
    import.meta.dirname,
    "../../../packages/python",
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

  await hmr.runEffect(import.meta.url, () => {
    const original = USER_DATA_PATH;
    app.setPath("userData", join(USER_DATA_PATH, "Default"));
    return () => {
      app.setPath("userData", original);
    };
  });

  const ANKI_MEDIA_PORT = 43568;

  const constant = {
    APP_NAME: "Seruni",
    ELECTRON_PATH: app.getPath("userData"),
    USER_DATA_PATH,
    CACHE_PATH,
    TEMP_PATH,

    PYTHON_EXTRACT_PATH,
    PYTHON_BIN_PATH: DEV ? PYTHON_BIN_PATH_DEV2 : PYTHON_BIN_PATH,
    PYTHON_ENTRY_PATH: DEV ? PYTHON_ENTRY_PATH_DEV : PYTHON_ENTRY_PATH,
    PYTHON_PACKAGE_PATH: DEV ? PYTHON_PACKAGE_PATH_DEV : PYTHON_PACKAGE_PATH,

    IPC_PRELOAD_PATH: DEV ? IPC_PRELOAD_PATH_DEV : IPC_PRELOAD_PATH,
    CHROME_PRELOAD_PATH: DEV ? CHROME_PRELOAD_PATH_DEV : CHROME_PRELOAD_PATH,
    RENDERER_PATH: DEV ? RENDERER_PATH_DEV : RENDERER_PATH,
    RENDERER_URL: `http://localhost:${validatedEnv.RENDERER_PORT}`,
    ANKI_MEDIA_PORT,
    ANKI_MEDIA_URL: `http://localhost:${ANKI_MEDIA_PORT}`,
  };

  return {
    ...validatedEnv,
    ...constant,
  } as const;
}

export const env = await createEnv_();
