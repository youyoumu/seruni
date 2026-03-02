import path from "node:path";

import { serve } from "@hono/node-server";
import { createNodeWebSocket } from "@hono/node-ws";
import { R } from "@praha/byethrow";
import { session } from "@repo/shared/db";
import { createServerApi } from "@repo/shared/ws";
import { defineCommand, runMain } from "citty";
import * as c from "colorette";
import { Hono } from "hono";
import { cors } from "hono/cors";
import pino from "pino";

import { AnkiConnectClient } from "./client/anki-connect.client";
import { OBSClient } from "./client/obs.client";
import { TextHookerClient } from "./client/text-hooker.client";
import { createDb } from "./db";
import { DBClient } from "./db/db.client";
import { FFmpegExec } from "./exec/ffmpeg.exec";
import { PythonExec } from "./exec/python.exec";
import { TarExec } from "./exec/tar.exec";
import { UvExec } from "./exec/uv.exec";
import * as routes from "./routes";
import { ConfigManager, StateManager } from "./state/state";
import type { AppContext } from "./types/types";
import { safeReadDir, safeRm } from "./util/fs";
import { createLogger } from "./util/logger";
import { WSSHandlers } from "./wss/handlers";

function validateLogLevel(level: string): pino.Level {
  const levels = ["trace", "debug", "info", "warn", "error", "fatal"] as pino.Level[];
  if (!levels.includes(level as pino.Level)) {
    return "trace";
  }
  return level as pino.Level;
}

async function start(options: { dataDir: string; logLevel: pino.Level }) {
  const log = createLogger({ level: options.logLevel }).child({ name: "main" });
  const configManager = new ConfigManager(log);
  const state = await StateManager.createState({ dataDir: options.dataDir, configManager });
  new StateManager(log, state);

  const ffmpeg = new FFmpegExec(log, state);
  const python = new PythonExec(log, state);
  const uv = new UvExec(log, state);
  const tar = new TarExec(log, state);

  const binding = await tar.getBinding();
  if (R.isFailure(binding)) return console.error(c.red(`[ERROR] ${binding.error.message}`));
  if (!binding.value.exists) {
    const downloadR = await tar.downloadBinding();
    if (R.isFailure(downloadR)) return console.error(c.red(`[ERROR] ${downloadR.error.message}`));
  }

  const venvR = await R.pipe(
    python.version(),
    R.orElse(() => {
      log.info("Setting up Python virtual environment");
      return uv.setupVenv();
    }),
  );
  if (R.isFailure(venvR)) return console.error(c.red(`[ERROR] ${venvR.error.message}`));

  const doctorR = await R.pipe(
    R.collect([ffmpeg.version(), python.version(), uv.version(), tar.version()]),
    R.inspectError(() => {
      log.error("Some dependencies are broken or missing");
    }),
  );
  if (R.isFailure(doctorR))
    return console.error(c.red(`[ERROR] ${doctorR.error.map((e) => e.message).join("\n")}`));

  const db = createDb(state);
  const dbClient = new DBClient(db, log, state);

  const { api, onPayload, addWS, removeWS } = createServerApi();
  const app = new Hono<{ Variables: { ctx: AppContext } }>();
  const nodews = createNodeWebSocket({ app });

  new TextHookerClient(log, api, db, state);
  const obsClient = new OBSClient(log, state);
  const ankiConnectClient = new AnkiConnectClient(
    log,
    state,
    db,
    dbClient,
    api,
    obsClient,
    ffmpeg,
    python,
  );

  // migrate database
  await dbClient.migrate();

  // remove temp files
  void R.pipe(
    safeReadDir(state.path().tempDir),
    R.inspect((files) => {
      files.forEach((file) => {
        void safeRm(path.join(state.path().tempDir, file), { recursive: true });
      });
    }),
  );

  // make at least one session exists
  const sessions = await db.select().from(session);
  let lastSession = sessions[sessions.length - 1];
  if (!lastSession) {
    lastSession = db
      .insert(session)
      .values({
        name: "Default Session",
      })
      .returning()
      .get();
  }
  state.activeSessionId(lastSession.id);

  const ctx: AppContext = {
    db,
    state,
    log: log,
    api,
    onPayload,
    addWS,
    removeWS,
    upgradeWebSocket: nodews.upgradeWebSocket,
    ankiConnectClient,
  };

  app.use(
    "*",
    cors({
      origin(origin) {
        // Matches http://localhost:ANY_PORT or http://127.0.0.1:ANY_PORT
        const isLocal = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
        return isLocal ? origin : null;
      },
    }),
  );
  app.use(async (c, next) => {
    c.set("ctx", ctx);
    await next();
  });

  app.route("/", routes.root);
  app.route("/assets", routes.assets);
  app.route("/ws", routes.ws);
  app.route("/anki/collection.media", routes.ankiCollectionMedia);
  app.route("/anki/anki-connect-proxy", routes.ankiAnkiConnectProxy);
  app.route("*", routes.root);

  new WSSHandlers(api, db, state, log);
  const server = serve(
    {
      fetch: app.fetch,
      port: 45626,
    },
    (info) => {
      log.info(`Server is running on http://localhost:${info.port}`);
    },
  );
  nodews.injectWebSocket(server);
}

async function doctor(options: { dataDir: string; logLevel: pino.Level }) {
  const log = createLogger({ level: options.logLevel }).child({ name: "doctor" });
  const configManager = new ConfigManager(log);
  const state = await StateManager.createState({ dataDir: options.dataDir, configManager });
  new StateManager(log, state);

  const ffmpeg = new FFmpegExec(log, state);
  const uv = new UvExec(log, state);
  const python = new PythonExec(log, state);
  const tar = new TarExec(log, state);

  const ffmpegResult = await ffmpeg.version();
  const uvResult = await uv.version();
  const pythonResult = await python.version();
  const tarResult = await tar.version();

  const logResult = (name: string, result: R.Result<string, Error>) => {
    const label = R.isSuccess(result) ? c.green("OK") : c.red("ERROR");
    const message = R.isSuccess(result)
      ? result.value.trim()
      : c.yellow(result.error.message.split("\n")[0]?.trim() ?? "");
    console.log(`[${c.cyan(name)}] [${label}]: ${message}`);
  };

  logResult("uv", uvResult);
  logResult("FFmpeg", ffmpegResult);
  logResult("Python", pythonResult);
  logResult("tar", tarResult);
}

async function venv(options: { dataDir: string; logLevel: pino.Level }) {
  const log = createLogger({ level: options.logLevel }).child({ name: "venv" });
  const configManager = new ConfigManager(log);
  const state = await StateManager.createState({ dataDir: options.dataDir, configManager });
  new StateManager(log, state);

  const uv = new UvExec(log, state);

  const result = await uv.setupVenv();
  if (R.isFailure(result)) return console.error(c.red(`[ERROR] ${result.error.message}`));
  return console.log(c.green(`[OK] ${state.path().venvDir}`));
}

async function binding(options: { dataDir: string; logLevel: pino.Level }) {
  const log = createLogger({ level: options.logLevel }).child({ name: "binding" });
  const configManager = new ConfigManager(log);
  const state = await StateManager.createState({ dataDir: options.dataDir, configManager });
  new StateManager(log, state);

  const tar = new TarExec(log, state);

  const result = await tar.downloadBinding();
  if (R.isFailure(result)) return console.error(c.red(`[ERROR] ${result.error.message}`));
  return console.log(c.green(`[OK] Binding installed`));
}

async function update(options: { dataDir: string; logLevel: pino.Level; tarFilePath?: string }) {
  const log = createLogger({ level: options.logLevel }).child({ name: "update" });
  const configManager = new ConfigManager(log);
  const state = await StateManager.createState({ dataDir: options.dataDir, configManager });
  new StateManager(log, state);

  const tar = new TarExec(log, state);
  const result = await tar.update(options.tarFilePath);
  if (R.isFailure(result)) {
    return log.error(result.error, "Failed to update");
  }
  log.info("Update completed successfully");
}

const startCmd = defineCommand({
  meta: {
    name: "start",
    description: "Start the Seruni server",
  },
  args: {
    "data-dir": {
      type: "string",
      description: "Data directory for the server",
      default: process.cwd(),
    },
    "log-level": {
      type: "string",
      description: "Log level (trace, debug, info, warn, error, fatal)",
      default: "trace",
    },
  },
  run({ args }) {
    const logLevel = validateLogLevel(args["log-level"]);
    return start({ dataDir: args["data-dir"], logLevel });
  },
});

const doctorCmd = defineCommand({
  meta: {
    name: "doctor",
    description: "Check dependencies",
  },
  args: {
    "data-dir": {
      type: "string",
      description: "Data directory",
      default: process.cwd(),
    },
    "log-level": {
      type: "string",
      description: "Log level (trace, debug, info, warn, error, fatal)",
      default: "info",
    },
  },
  run({ args }) {
    const logLevel = validateLogLevel(args["log-level"]);
    return doctor({ dataDir: args["data-dir"], logLevel });
  },
});

const venvCmd = defineCommand({
  meta: {
    name: "venv",
    description: "Setup a Python virtual environment",
  },
  args: {
    "data-dir": {
      type: "string",
      description: "Data directory",
      default: process.cwd(),
    },
    "log-level": {
      type: "string",
      description: "Log level (trace, debug, info, warn, error, fatal)",
      default: "trace",
    },
  },
  run({ args }) {
    const logLevel = validateLogLevel(args["log-level"]);
    return venv({ dataDir: args["data-dir"], logLevel });
  },
});

const bindingCmd = defineCommand({
  meta: {
    name: "binding",
    description: "Download and install native bindings for better-sqlite3",
  },
  args: {
    "data-dir": {
      type: "string",
      description: "Data directory",
      default: process.cwd(),
    },
    "log-level": {
      type: "string",
      description: "Log level (trace, debug, info, warn, error, fatal)",
      default: "trace",
    },
  },
  run({ args }) {
    const logLevel = validateLogLevel(args["log-level"]);
    return binding({ dataDir: args["data-dir"], logLevel });
  },
});

const updateCmd = defineCommand({
  meta: {
    name: "update",
    description: "Update Seruni",
  },
  args: {
    "data-dir": {
      type: "string",
      description: "Data directory",
      default: process.cwd(),
    },
    "log-level": {
      type: "string",
      description: "Log level (trace, debug, info, warn, error, fatal)",
      default: "trace",
    },
    file: {
      type: "string",
      description: "Path to update package (auto-detected if omitted)",
    },
  },
  run({ args }) {
    const logLevel = validateLogLevel(args["log-level"]);
    return update({ dataDir: args["data-dir"], logLevel, tarFilePath: args.file });
  },
});

const main = defineCommand({
  meta: {
    name: "seruni",
    description: "TODO",
    version: "0.0.1",
  },
  subCommands: {
    start: startCmd,
    doctor: doctorCmd,
    venv: venvCmd,
    binding: bindingCmd,
    update: updateCmd,
  },
  run() {},
});

await runMain(main);
