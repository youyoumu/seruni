import { readFile } from "node:fs/promises";
import fs from "node:fs/promises";
import path from "node:path";

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
  const venv = path.join(pythonWorkdir, ".venv") ?? path.join(workdir, "./venv");
  const path_ = {
    config: path.join(workdir, "./config.json"),
    db: path.join(workdir, "./db.sqlite"),
    tempDir: path.join(workdir, "./temp"),
    storageDir: path.join(workdir, "./storage"),
    python:
      process.platform === "win32"
        ? path.join(venv, "Scripts/python.exe")
        : path.join(venv, "bin/python"),
    pythonEntry,
  };

  await fs.mkdir(path_.tempDir, { recursive: true });
  await fs.mkdir(path_.storageDir, { recursive: true });
  const config = await getConfigFromFile(path_.config);

  const state = {
    appName: "Seruni",
    config: signal(config),
    path: signal(path_),
    activeSessionId: signal<number | null>(null),
    isListeningTexthooker: signal<boolean>(false),
    textHookerConnected: signal<boolean>(false),
    ankiConnectConnected: signal<boolean>(false),
    obsConnected: signal<boolean>(false),
    yomitanAnkiConnectDeckName: signal<string>(),
  };

  let isWritingConfig = false;
  effect(async () => {
    try {
      if (isWritingConfig) return;
      isWritingConfig = true;
      const config = state.config();
      const configPath = state.path().config;
      await fs.writeFile(configPath, JSON.stringify(config, null, 2));
    } finally {
      isWritingConfig = false;
    }
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
  await fs.mkdir(path.join(configFilePath, ".."), { recursive: true });
  let parsedConfig: unknown;
  try {
    const configFile = await readFile(configFilePath, "utf-8");
    parsedConfig = JSON.parse(configFile);
  } catch {
    parsedConfig = {};
  }
  const defaultConfig = zConfig.parse({});
  const configResult = zConfig.safeParse(parsedConfig);
  return configResult.success ? configResult.data : defaultConfig;
}
