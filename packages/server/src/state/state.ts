import path from "node:path";
import { fileURLToPath } from "node:url";

import { safeMkdir, safeReadFile, safeWriteFile } from "#/util/fs";
import { safeJSONParse } from "#/util/result";
import { R } from "@praha/byethrow";
import { defaultConfig, zConfig, type Config } from "@repo/shared/schema";
import { effect, signal } from "alien-signals";
import type { Logger } from "pino";
import * as z from "zod/mini";

type Signal<T> = {
  (): T;
  (value: T): void;
};

export type Path = {
  config: string;
  db: string;
  tempDir: string;
  trashDir: string;
  storageDir: string;
  drizzleDir: string;
  webuiDir: string;
  venvDir: string;
  python: string;
  pythonEntry: string;
  pythonWorkdir: string;
  entry: string;
  libDir: string;
  packageJson: string;
};

export type State = {
  appName: string;
  actionMap: Map<string, () => void>;
  config: Signal<Config>;
  path: Signal<Path>;
  activeSessionId: Signal<number | null>;
  isListeningTexthooker: Signal<boolean>;
  completedTextHistory: Signal<Record<number, number>>;
  textHookerConnected: Signal<boolean>;
  ankiConnectConnected: Signal<boolean>;
  obsConnected: Signal<boolean>;
  yomitanAnkiConnectDeckName: Signal<string>;
};

export class StateManager {
  constructor(
    public log: Logger,
    public workdir: string,
  ) {
    this.log = log.child({ name: "state" });
  }

  async createState() {
    //@ts-expect-error injected during build
    const DEV = typeof __DEV__ === "undefined";
    const entry = fileURLToPath(import.meta.url);
    const installationDir = path.dirname(entry);

    const workdir = path.resolve(this.workdir ?? process.cwd());
    const pythonWorkdir = DEV
      ? path.join(import.meta.dirname, "../../../python")
      : path.join(installationDir, "./python");
    const pythonEntry = path.join(pythonWorkdir, "src/main.py");
    const venvDir = DEV ? path.join(pythonWorkdir, ".venv") : path.join(workdir, "./venv");

    const path_: Path = {
      config: path.join(workdir, "./config.json"),
      db: path.join(workdir, "./db.sqlite"),
      tempDir: path.join(workdir, "./temp"),
      trashDir: path.join(workdir, "./trash"),
      storageDir: path.join(workdir, "./storage"),
      drizzleDir: DEV
        ? path.join(import.meta.dirname, "../../drizzle")
        : path.join(installationDir, "./drizzle"),
      webuiDir: DEV
        ? path.join(import.meta.dirname, "../../../webui/dist")
        : path.join(installationDir, "./webui"),
      venvDir,
      python:
        process.platform === "win32"
          ? path.join(venvDir, "Scripts/python.exe")
          : path.join(venvDir, "bin/python"),
      pythonEntry,
      pythonWorkdir,
      entry: entry,
      libDir: DEV
        ? path.join(import.meta.dirname, "../../.lib")
        : path.join(installationDir, "./lib"),
      packageJson: DEV
        ? path.join(import.meta.dirname, "../../package.json")
        : path.join(installationDir, "./package.json"),
    };

    const dirToCreate = [
      path_.tempDir,
      path_.trashDir,
      path_.storageDir,
      path_.drizzleDir,
      path_.venvDir,
    ];
    await Promise.all(dirToCreate.map((dir) => safeMkdir(dir, { recursive: true })));
    const config = await this.getConfigFromFile(path_.config);

    const state: State = {
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
      yomitanAnkiConnectDeckName: signal<string>(""),
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

  serializeState(state: State) {
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

  async getConfigFromFile(configFilePath: string) {
    await safeMkdir(path.join(configFilePath, ".."), { recursive: true });

    const parsedFile = await R.pipe(
      safeReadFile(configFilePath, "utf-8"),
      R.andThen((text) => safeJSONParse(text)),
      R.inspectError((e) => {
        this.log.error(e, "Failed to parse config, fallback to default");
      }),
    );

    if (R.isFailure(parsedFile)) {
      return defaultConfig;
    }

    const rawData = parsedFile.value as Record<string, unknown>;
    const finalConfig: Config = { ...defaultConfig };

    for (const key of Object.keys(zConfig.shape)) {
      const fieldSchema = zConfig.shape[key as keyof Config];
      const rawValue = rawData[key];
      if (rawValue === undefined) {
        this.log.warn(`Config field "${key}" is missing. Using default value.`);
        continue;
      }

      const result = fieldSchema.safeParse(rawValue);
      if (result.success) {
        (finalConfig as Record<string, unknown>)[key] = result.data;
      } else {
        const error = z.prettifyError(result.error);
        this.log.error(
          { key, error, rawValue },
          `Invalid config field "${key}". Using default value.`,
        );
      }
    }

    return finalConfig;
  }
}
