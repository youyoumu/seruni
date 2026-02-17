import { serve } from "@hono/node-server";
import { createNodeWebSocket } from "@hono/node-ws";
import { session } from "@repo/shared/db";
import { createServerApi } from "@repo/shared/ws";
import chalk from "chalk";
import { Command } from "commander";
import { Hono } from "hono";
import { cors } from "hono/cors";
import pino from "pino";

import { AnkiConnectClient } from "./client/anki-connect.client";
import { OBSClient } from "./client/obs.client";
import { TextHookerClient } from "./client/text-hooker.client";
import { createDb } from "./db";
import { FFmpegExec } from "./exec/ffmpeg.exec";
import { PythonExec } from "./exec/python.exec";
import { UvExec } from "./exec/uv.exec";
import { ankiAnkiConnectProxyRoute } from "./routes/anki.anki-connect-proxy";
import { ankiCollectionMediaRoute } from "./routes/anki.collection.media";
import { indexRoute } from "./routes/index";
import { wsRoute } from "./routes/ws";
import { createState, serializeState } from "./state/state";
import type { AppContext } from "./types/types";
import { createLogger } from "./util/logger";
import { registerHandlers } from "./wss/handlers";

function validateLogLevel(level: string): pino.Level | Error {
  const levels = ["trace", "debug", "info", "warn", "error", "fatal"] as pino.Level[];
  if (!levels.includes(level as pino.Level)) {
    return new Error(`Invalid log level '${level}'. Valid options: ${levels.join(", ")}`);
  }
  return level as pino.Level;
}

async function start(options: { workdir: string; logLevel: pino.Level }) {
  const logger = createLogger({ level: options.logLevel });
  const log = logger.child({ name: "main" });
  const { api, onPayload, addWS, removeWS } = createServerApi();
  const state = await createState({ workdir: options.workdir });
  log.info(serializeState(state), "Starting with state");
  const db = createDb(state);
  const app = new Hono<{ Variables: { ctx: AppContext } }>();
  const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

  const ctx: AppContext = { db, state, logger, api, onPayload, addWS, removeWS, upgradeWebSocket };

  //TODO: whitelist
  app.use("*", cors());
  app.use(async (c, next) => {
    c.set("ctx", ctx);
    await next();
  });

  const sessions = await db.select().from(session);
  let lastSession = sessions[sessions.length - 1];
  if (!lastSession) {
    lastSession = await db
      .insert(session)
      .values({
        name: "Default Session",
      })
      .returning()
      .get();
  }
  state.activeSessionId(lastSession.id);

  registerHandlers({ api, db, state, logger });

  app.route("/", indexRoute);
  app.route("/ws", wsRoute);
  app.route("/anki/collection.media", ankiCollectionMediaRoute);
  app.route("/anki/anki-connect-proxy", ankiAnkiConnectProxyRoute);

  const server = serve(
    {
      fetch: app.fetch,
      port: 45626,
    },
    (info) => {
      logger.info(`Server is running on http://localhost:${info.port}`);
    },
  );
  injectWebSocket(server);

  new TextHookerClient({ logger, api, db, state });
  new AnkiConnectClient({ logger, state });
  new OBSClient({ logger, state });
}

async function doctor(options: { workdir: string; logLevel: pino.Level }) {
  const state = await createState({ workdir: options.workdir });
  const logger = createLogger({ level: options.logLevel });

  const ffmpeg = new FFmpegExec({ logger, state });
  const uv = new UvExec({ logger, state });
  const python = new PythonExec({ logger, state });

  const ffmpegResult = await ffmpeg.version();
  const uvResult = await uv.version();
  const pythonResult = await python.version();

  const logResult = (name: string, result: string | Error) => {
    const isOk = typeof result === "string";
    const label = isOk ? chalk.green("OK") : chalk.red("ERROR");
    const message = isOk ? result : chalk.yellow(result.message.split("\n")[0]);
    console.log(`[${chalk.cyan(name)}] [${label}]: ${message}`);
  };

  logResult("uv", uvResult);
  logResult("FFmpeg", ffmpegResult);
  logResult("Python", pythonResult);
}

function main() {
  const program = new Command();

  program.name("seruni").description("TODO").version("0.0.1");

  program
    .command("start")
    .description("Start the Seruni server")
    .argument("[workdir]", "Working directory for the server", process.cwd())
    .option("--log-level <level>", "Log level (trace, debug, info, warn, error, fatal)", "trace")
    .action(async (workdir: string, options: { logLevel: string }) => {
      const logLevel = validateLogLevel(options.logLevel);
      if (logLevel instanceof Error) {
        console.error(chalk.red(`[ERROR] ${logLevel.message}`));
        return;
      }
      await start({ workdir, logLevel });
    });

  program
    .command("doctor")
    .description("Check dependencies")
    .argument("[workdir]", "Working directory for the server", process.cwd())
    .option("--log-level <level>", "Log level (trace, debug, info, warn, error, fatal)", "info")
    .action(async (workdir: string, options: { logLevel: string }) => {
      const logLevel = validateLogLevel(options.logLevel);
      if (logLevel instanceof Error) {
        console.error(chalk.red(`[ERROR] ${logLevel.message}`));
        return;
      }
      await doctor({ workdir, logLevel });
    });

  program
    .command("venv")
    .description("Setup a Python virtual environment")
    .argument("[workdir]", "Working directory for the server", process.cwd())
    .option("--log-level <level>", "Log level (trace, debug, info, warn, error, fatal)", "trace")
    .action(async (workdir: string, options: { logLevel: string }) => {
      const logLevel = validateLogLevel(options.logLevel);
      if (logLevel instanceof Error) {
        console.error(chalk.red(`[ERROR] ${logLevel.message}`));
        return;
      }
    });

  program.parse();
}

main();
