import path from "node:path";

import { safeMkdir, safeReadFile, safeWriteFile } from "#/util/fs";
import { safeJSONParse } from "#/util/result";
import { R } from "@praha/byethrow";
import { zConfig } from "@repo/shared/schema";
import { effect, signal } from "alien-signals";

export type State = Awaited<ReturnType<typeof createState>>;
export async function createState(
  options: {
    workdir?: string;
  } = {},
) {
  //@ts-expect-error injected during build
  const DEV = typeof __DEV__ === "undefined";

  const workdir = path.resolve(options.workdir ?? process.cwd());
  const pythonWorkdir = DEV
    ? path.join(import.meta.dirname, "../../../python")
    : path.join(workdir, "./python");
  const pythonEntry = path.join(pythonWorkdir, "src/main.py");
  const venvDir = DEV ? path.join(pythonWorkdir, ".venv") : path.join(workdir, "./venv");
  const path_ = {
    config: path.join(workdir, "./config.json"),
    db: path.join(workdir, "./db.sqlite"),
    tempDir: path.join(workdir, "./temp"),
    storageDir: path.join(workdir, "./storage"),
    drizzleDir: DEV
      ? path.join(import.meta.dirname, "../../drizzle")
      : path.join(workdir, "./drizzle"),
    webuiDir: DEV
      ? path.join(import.meta.dirname, "../../../webui/dist")
      : path.join(workdir, "./webui"),
    venvDir,
    python:
      process.platform === "win32"
        ? path.join(venvDir, "Scripts/python.exe")
        : path.join(venvDir, "bin/python"),
    pythonEntry,
    pythonWorkdir,
  };

  const dirToCreate = [path_.tempDir, path_.storageDir, path_.drizzleDir, path_.venvDir];
  await Promise.all(dirToCreate.map((dir) => safeMkdir(dir, { recursive: true })));
  const config = await getConfigFromFile(path_.config);

  const state = {
    appName: "Seruni",
    actionMap: new Map<string, () => void>(),
    config: signal(config),
    path: signal(path_),
    activeSessionId: signal<number | null>(null),
    isListeningTexthooker: signal<boolean>(false),
    completedTextHistory: signal<Record<number, number>>({}),
    textHookerConnected: signal<boolean>(false),
    ankiConnectConnected: signal<boolean>(false),
    obsConnected: signal<boolean>(false),
    yomitanAnkiConnectDeckName: signal<string>(),
  };

  let isWritingConfig = false;
  effect(async () => {
    if (isWritingConfig) return;
    isWritingConfig = true;
    const config = state.config();
    const configPath = state.path().config;
    await safeWriteFile(configPath, JSON.stringify(config, null, 2));
    isWritingConfig = false;
  });

  return state;
}

export function serializeState(state: State) {
  const result = {} as Record<string, unknown>;
  for (const key in state) {
    const property = state[key as keyof State];
    if (typeof property === "function") {
      result[key] = property();
    } else {
      result[key] = property;
    }
  }
  return result;
}

async function getConfigFromFile(configFilePath: string) {
  await safeMkdir(path.join(configFilePath, ".."), { recursive: true });
  const parsedConfig = await R.pipe(
    safeReadFile(configFilePath, "utf-8"),
    R.andThen((text) => safeJSONParse(text)),
    R.orElse(() => R.succeed({})),
  );
  //TODO:report individual config entry
  const defaultConfig = zConfig.parse({});
  if (R.isFailure(parsedConfig)) {
    return defaultConfig;
  }
  const configResult = zConfig.safeParse(parsedConfig.value);
  return configResult.success ? configResult.data : defaultConfig;
}
