import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { TextHookerClient } from "./client/text-hooker.client";
import { createLogger } from "./util/logger";

import { createNodeWebSocket } from "@hono/node-ws";
import { createServerApi } from "@repo/shared/ws";
import type {} from "@repo/shared/types";
import type { WSPayload } from "@repo/shared/events";
import { createDb } from "./db";
import { session } from "@repo/shared/db";

async function main() {
  const logger = createLogger();
  const { api, wsBridge } = createServerApi();
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
    const userAgent = await api.request("req_user_agent");
    console.log("DEBUG[1514]: userAgent=", userAgent);
  }, 3000);

  api.addReqHandler("req_config", () => {
    return { workdir: "test" };
  });

  api.addPushHandler("ping", (e) => {
    console.log("Received ping");
  });

  app.get(
    "/ws",
    upgradeWebSocket(() => {
      return {
        onMessage(e, _ws) {
          const payload: WSPayload = JSON.parse(e.data.toString());
          wsBridge.onPayload(payload);
        },
        onOpen: (_, ws) => {
          log.info("Connection opened");
          wsBridge.addWS(ws);
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
