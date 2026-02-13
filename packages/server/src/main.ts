import { serve } from "@hono/node-server";
import { createNodeWebSocket } from "@hono/node-ws";
import { session } from "@repo/shared/db";
import { createServerApi } from "@repo/shared/ws";
import { Hono } from "hono";

import { TextHookerClient } from "./client/text-hooker.client";
import { createDb } from "./db";
import { createState } from "./state/state";
import { createLogger } from "./util/logger";
import { registerHandlers } from "./wss/handlers";

async function main() {
  const logger = createLogger();
  const log = logger.child({ name: "client" });
  const { api, addWS, removeWS, onPayload } = createServerApi();
  const db = createDb();
  const state = createState();
  const app = new Hono();
  const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

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

  app.get("/", (c) => {
    return c.text("Hello Hono!");
  });

  registerHandlers({ api, db, state });

  app.get(
    "/ws",
    upgradeWebSocket(() => {
      return {
        onMessage(e, ws) {
          const payload = JSON.parse(e.data.toString());
          onPayload(payload, ws);
        },
        onOpen: (_, ws) => {
          log.info("Connection opened");
          addWS(ws);
        },
        onClose: (_, ws) => {
          log.warn("Connection closed");
          removeWS(ws);
        },
      };
    }),
  );

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
}

main();
