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
import { StateManager } from "./state/state";
import type { AppContext } from "./types/types";
import { safeReadDir, safeRm } from "./util/fs";
import { createLogger } from "./util/logger";
import { anyFail } from "./util/result";
import { WSSHandlers } from "./wss/handlers";

function validateLogLevel(level: string): R.Result<pino.Level, Error> {
  const levels = ["trace", "debug", "info", "warn", "error", "fatal"] as pino.Level[];
  if (!levels.includes(level as pino.Level)) {
    return anyFail(`Invalid log level '${level}'. Valid options: ${levels.join(", ")}`);
  }
  return R.succeed(level as pino.Level);
}

async function start(options: { dataDir: string; logLevel: pino.Level }) {
  const log = createLogger({ level: options.logLevel }).child({ name: "main" });
  const { api, onPayload, addWS, removeWS } = createServerApi();
  const stateManager = new StateManager(log, options.dataDir);
  const state = await stateManager.createState();
  log.info(stateManager.serializeState(state), "Starting with state");
  const db = createDb(state);
  const app = new Hono<{ Variables: { ctx: AppContext } }>();
  const nodews = createNodeWebSocket({ app });

  const dbClient = new DBClient(db, log, state);

  const ffmpeg = new FFmpegExec(log, state);
  const python = new PythonExec(log, state);

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
  const stateManager = new StateManager(log, options.dataDir);
  const state = await stateManager.createState();

  log.info(stateManager.serializeState(state), "Starting with state");

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
  const stateManager = new StateManager(log, options.dataDir);
  const state = await stateManager.createState();

  log.info(stateManager.serializeState(state), "Starting with state");

  const uv = new UvExec(log, state);

  const result = await uv.setupVenv();
  if (R.isFailure(result)) return console.error(c.red(`[ERROR] ${result.error.message}`));
  return console.log(c.green(`[OK] ${state.path().venvDir}`));
}

async function update(options: { dataDir: string; logLevel: pino.Level; tarFilePath?: string }) {
  const log = createLogger({ level: options.logLevel }).child({ name: "update" });
  const stateManager = new StateManager(log, options.dataDir);
  const state = await stateManager.createState();

  log.info(stateManager.serializeState(state), "Starting with state");

  const tar = new TarExec(log, state);
  const result = await tar.update(options.tarFilePath);
  if (R.isFailure(result)) {
    return log.error(result.error, "Failed to update");
  }
  log.info("Update completed successfully");
}

async function startCommand(args: { dataDir: string; logLevel: string }) {
  const logLevel = validateLogLevel(args.logLevel);
  if (R.isFailure(logLevel)) {
    return console.error(c.red(`[ERROR] ${logLevel.error.message}`));
  }
  await start({ dataDir: args.dataDir, logLevel: logLevel.value });
}

async function doctorCommand(args: { dataDir: string; logLevel: string }) {
  const logLevel = validateLogLevel(args.logLevel);
  if (R.isFailure(logLevel)) {
    return console.error(c.red(`[ERROR] ${logLevel.error.message}`));
  }
  await doctor({ dataDir: args.dataDir, logLevel: logLevel.value });
}

async function venvCommand(args: { dataDir: string; logLevel: string }) {
  const logLevel = validateLogLevel(args.logLevel);
  if (R.isFailure(logLevel)) {
    return console.error(c.red(`[ERROR] ${logLevel.error.message}`));
  }
  await venv({ dataDir: args.dataDir, logLevel: logLevel.value });
}

async function updateCommand(args: { dataDir: string; logLevel: string; tarFilePath?: string }) {
  const logLevel = validateLogLevel(args.logLevel);
  if (R.isFailure(logLevel)) {
    return console.error(c.red(`[ERROR] ${logLevel.error.message}`));
  }
  await update({ dataDir: args.dataDir, logLevel: logLevel.value, tarFilePath: args.tarFilePath });
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
    return startCommand({ dataDir: args["data-dir"], logLevel: args["log-level"] });
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
    return doctorCommand({
      dataDir: args["data-dir"],
      logLevel: args["log-level"],
    });
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
    return venvCommand({ dataDir: args["data-dir"], logLevel: args["log-level"] });
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
    return updateCommand({
      dataDir: args["data-dir"],
      logLevel: args["log-level"],
      tarFilePath: args.file,
    });
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
    update: updateCmd,
  },
  run() {},
});

await runMain(main);
