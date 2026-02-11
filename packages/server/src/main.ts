import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { TextHookerClient } from "./client/text-hooker.client";
import { createLogger } from "./util/logger";

import { createNodeWebSocket } from "@hono/node-ws";
import { createServerApi } from "@repo/shared/ws";
import type {} from "@repo/shared/types";
import type { WSPayload } from "@repo/shared/events";
import { createDb } from "./db";
import { session, textHistory } from "@repo/shared/db";
import { eq } from "drizzle-orm";

async function main() {
  const logger = createLogger();
  const { api, addWS, onPayload } = createServerApi();
  const db = createDb();
  const newSession = await db
    .insert(session)
    .values({
      name: new Date().toISOString(),
    })
    .returning()
    .get();

  const app = new Hono();
  const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

  app.get("/", (c) => {
    return c.text("Hello Hono!");
  });

  const log = logger.child({ name: "client" });

  setInterval(async () => {
    const userAgent = await api.request.userAgent();
    console.log("DEBUG[1514]: userAgent=", userAgent);
  }, 3000);

  api.handleRequest.config(() => {
    return { workdir: "test" };
  });

  api.handlePush.ping(() => {
    console.log("Received ping");
  });

  api.handleRequest.textHistoryBySessionId(async (id) => {
    return await db.select().from(textHistory).where(eq(textHistory.sessionId, id));
  });

  api.handleRequest.sessions(async () => {
    return await db.select().from(session);
  });

  app.get(
    "/ws",
    upgradeWebSocket(() => {
      return {
        onMessage(e, _ws) {
          const payload: WSPayload = JSON.parse(e.data.toString());
          onPayload(payload);
        },
        onOpen: (_, ws) => {
          log.info("Connection opened");
          addWS(ws);
        },
        onClose: () => {
          log.warn("Connection closed");
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

  new TextHookerClient({ logger, api, db, sessionId: newSession.id });
}

main();
