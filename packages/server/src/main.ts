import { serve } from "@hono/node-server";
import { createNodeWebSocket } from "@hono/node-ws";
import { session } from "@repo/shared/db";
import { createServerApi } from "@repo/shared/ws";
import { Hono } from "hono";
import { cors } from "hono/cors";

import { AnkiConnectClient } from "./client/anki-connect.client";
import { OBSClient } from "./client/obs.client";
import { TextHookerClient } from "./client/text-hooker.client";
import { createDb } from "./db";
import { ankiAnkiConnectProxyRoute } from "./routes/anki.anki-connect-proxy";
import { ankiCollectionMediaRoute } from "./routes/anki.collection.media";
import { indexRoute } from "./routes/index";
import { wsRoute } from "./routes/ws";
import { createState } from "./state/state";
import type { AppContext } from "./types/types";
import { createLogger } from "./util/logger";
import { registerHandlers } from "./wss/handlers";

async function main() {
  const logger = createLogger();
  const { api, onPayload, addWS, removeWS } = createServerApi();
  const db = createDb();
  const state = createState();
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

main();
