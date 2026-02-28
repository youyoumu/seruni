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
import { UvExec } from "./exec/uv.exec";
import * as routes from "./routes";
import { createState, serializeState } from "./state/state";
import type { AppContext } from "./types/types";
import { safeReadDir, safeRm } from "./util/fs";
import { createLogger } from "./util/logger";
import { anyFail } from "./util/result";
import { registerHandlers } from "./wss/handlers";

function validateLogLevel(level: string): R.Result<pino.Level, Error> {
  const levels = ["trace", "debug", "info", "warn", "error", "fatal"] as pino.Level[];
  if (!levels.includes(level as pino.Level)) {
    return anyFail(`Invalid log level '${level}'. Valid options: ${levels.join(", ")}`);
  }
  return R.succeed(level as pino.Level);
}

async function start(options: { workdir: string; logLevel: pino.Level }) {
  const logger = createLogger({ level: options.logLevel });
  const log = logger.child({ name: "main" });
  const { api, onPayload, addWS, removeWS } = createServerApi();
  const state = await createState({ workdir: options.workdir });
  log.info(serializeState(state), "Starting with state");
  const db = createDb(state);
  const app = new Hono<{ Variables: { ctx: AppContext } }>();
  const nodews = createNodeWebSocket({ app });

  const dbClient = new DBClient(db, logger, state);

  const ffmpeg = new FFmpegExec(logger, state);
  const python = new PythonExec(logger, state);

  new TextHookerClient(logger, api, db, state);
  const obsClient = new OBSClient(logger, state);
  const ankiConnectClient = new AnkiConnectClient(
    logger,
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
    logger,
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

  registerHandlers({ api, db, state, logger });
  app.route("/", routes.root);
  app.route("/assets", routes.assets);
  app.route("/ws", routes.ws);
  app.route("/anki/collection.media", routes.ankiCollectionMedia);
  app.route("/anki/anki-connect-proxy", routes.ankiAnkiConnectProxy);

  const server = serve(
    {
      fetch: app.fetch,
      port: 45626,
    },
    (info) => {
      logger.info(`Server is running on http://localhost:${info.port}`);
    },
  );
  nodews.injectWebSocket(server);
}

async function doctor(options: { workdir: string; logLevel: pino.Level }) {
  const state = await createState({ workdir: options.workdir });
  const logger = createLogger({ level: options.logLevel });
  const log = logger.child({ name: "doctor" });

  log.info(serializeState(state), "Starting with state");

  const ffmpeg = new FFmpegExec(logger, state);
  const uv = new UvExec(logger, state);
  const python = new PythonExec(logger, state);

  const ffmpegResult = await ffmpeg.version();
  const uvResult = await uv.version();
  const pythonResult = await python.version();

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
}

async function venv(options: { workdir: string; logLevel: pino.Level }) {
  const state = await createState({ workdir: options.workdir });
  const logger = createLogger({ level: options.logLevel });
  const log = logger.child({ name: "venv" });

  log.info(serializeState(state), "Starting with state");

  const uv = new UvExec(logger, state);

  const result = await uv.setupVenv();
  if (R.isFailure(result)) return console.error(c.red(`[ERROR] ${result.error.message}`));
  return console.log(c.green(`[OK] ${state.path().venvDir}`));
}

async function startCommand(args: { workdir: string; logLevel: string }) {
  const logLevel = validateLogLevel(args.logLevel);
  if (R.isFailure(logLevel)) {
    return console.error(c.red(`[ERROR] ${logLevel.error.message}`));
  }
  await start({ workdir: args.workdir, logLevel: logLevel.value });
}

async function doctorCommand(args: { workdir: string; logLevel: string }) {
  const logLevel = validateLogLevel(args.logLevel);
  if (R.isFailure(logLevel)) {
    return console.error(c.red(`[ERROR] ${logLevel.error.message}`));
  }
  await doctor({ workdir: args.workdir, logLevel: logLevel.value });
}

async function venvCommand(args: { workdir: string; logLevel: string }) {
  const logLevel = validateLogLevel(args.logLevel);
  if (R.isFailure(logLevel)) {
    return console.error(c.red(`[ERROR] ${logLevel.error.message}`));
  }
  await venv({ workdir: args.workdir, logLevel: logLevel.value });
}

const startCmd = defineCommand({
  meta: {
    name: "start",
    description: "Start the Seruni server",
  },
  args: {
    workdir: {
      type: "positional",
      description: "Working directory for the server",
      default: process.cwd(),
    },
    "log-level": {
      type: "string",
      description: "Log level (trace, debug, info, warn, error, fatal)",
      default: "trace",
    },
  },
  run({ args }) {
    return startCommand({ workdir: args.workdir as string, logLevel: args["log-level"] as string });
  },
});

const doctorCmd = defineCommand({
  meta: {
    name: "doctor",
    description: "Check dependencies",
  },
  args: {
    workdir: {
      type: "positional",
      description: "Working directory for the server",
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
      workdir: args.workdir as string,
      logLevel: args["log-level"] as string,
    });
  },
});

const venvCmd = defineCommand({
  meta: {
    name: "venv",
    description: "Setup a Python virtual environment",
  },
  args: {
    workdir: {
      type: "positional",
      description: "Working directory for the server",
      default: process.cwd(),
    },
    "log-level": {
      type: "string",
      description: "Log level (trace, debug, info, warn, error, fatal)",
      default: "trace",
    },
  },
  run({ args }) {
    return venvCommand({ workdir: args.workdir as string, logLevel: args["log-level"] as string });
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
  },
  run() {},
});

await runMain(main);
