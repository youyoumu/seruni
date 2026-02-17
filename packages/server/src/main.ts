import { serve } from "@hono/node-server";
import { createNodeWebSocket } from "@hono/node-ws";
import { session } from "@repo/shared/db";
import { createServerApi } from "@repo/shared/ws";
import { Command } from "commander";
import { Hono } from "hono";
import { cors } from "hono/cors";
import pino from "pino";

import { AnkiConnectClient } from "./client/anki-connect.client";
import { OBSClient } from "./client/obs.client";
import { TextHookerClient } from "./client/text-hooker.client";
import { createDb } from "./db";
import { ankiAnkiConnectProxyRoute } from "./routes/anki.anki-connect-proxy";
import { ankiCollectionMediaRoute } from "./routes/anki.collection.media";
import { indexRoute } from "./routes/index";
import { wsRoute } from "./routes/ws";
import { createState, serializeState } from "./state/state";
import type { AppContext } from "./types/types";
import { createLogger } from "./util/logger";
import { registerHandlers } from "./wss/handlers";

function validateDebugLevel(level: string): pino.Level | Error {
  const levels = ["trace", "debug", "info", "warn", "error", "fatal"] as pino.Level[];
  if (!levels.includes(level as pino.Level)) {
    return new Error(`Invalid log level: ${level}`);
  }
  return level as pino.Level;
}

async function start(options: { workdir: string; debug: pino.Level }) {
  const logger = createLogger({ level: options.debug });
  const log = logger.child({ name: "main" });
  const { api, onPayload, addWS, removeWS } = createServerApi();
  const state = createState({ workdir: options.workdir });
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

function main() {
  const program = new Command();

  program.name("seruni").description("TODO").version("0.0.1");

  program
    .command("start")
    .description("Start the Seruni server")
    .argument("[workdir]", "Working directory for the server", process.cwd())
    .option("-d, --debug <level>", "Log level (trace, debug, info, warn, error, fatal)", "trace")
    .action(async (workdir: string, options: { debug: string }) => {
      const debug = validateDebugLevel(options.debug);
      if (debug instanceof Error) {
        console.error(debug.message);
        return;
      }
      await start({ workdir, debug });
    });

  program.parse();
}

main();
