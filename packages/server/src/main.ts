import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { TextHookerClient } from "./client/text-hooker.client";
import { createLogger } from "./util/logger";
import { type WSPayload } from "@repo/shared/ws";

import { createNodeWebSocket } from "@hono/node-ws";
import { createBusCenter, serverOnMessage, serverOnOpen } from "@repo/shared/events";

function main() {
  const logger = createLogger();
  const bus = createBusCenter();
  const api = bus.server.api;

  const app = new Hono();
  const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

  app.get("/", (c) => {
    return c.text("Hello Hono!");
  });

  const log = logger.child({ name: "client" });

  setInterval(async () => {
    const userAgent = await bus.server.req.request("req_user_agent");
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
        onMessage(e, ws) {
          const payload: WSPayload = JSON.parse(e.data.toString());
          serverOnMessage(payload, bus);
        },
        onOpen: (_, ws) => {
          log.info("Connection opened");
          serverOnOpen(bus, ws);
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

  new TextHookerClient({ logger, api });
}

main();
