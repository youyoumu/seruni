import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { TextHookerClient } from "./client/text-hooker.client";
import { createLogger } from "./util/logger";

import { createNodeWebSocket } from "@hono/node-ws";
import { createBusCenter } from "./util/bus";

function main() {
  const logger = createLogger();
  const bus = createBusCenter();

  const app = new Hono();
  const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

  app.get("/", (c) => {
    return c.text("Hello Hono!");
  });

  const log = logger.child({ name: "client" });

  app.get(
    "/ws",
    upgradeWebSocket(() => {
      return {
        onMessage(e, ws) {
          const payload = JSON.parse(e.data.toString());
          bus.req.client.dispatchTypedEvent(
            payload.type,
            new CustomEvent(payload.type, { detail: payload.data }),
          );
        },
        onOpen: (_, ws) => {
          log.info("Connection opened");

          bus.push.server.addEventListener("text_history", (e) => {
            ws.send(
              JSON.stringify({
                type: "text_history",
                data: e.detail,
              }),
            );
          });

          bus.res.server.addEventListener("res_config", (e) => {
            ws.send(
              JSON.stringify({
                type: "res_config",
                data: e.detail,
              }),
            );
          });

          bus.req.client.addEventListener("req_config", (e) => {
            bus.res.server.dispatchTypedEvent(
              "res_config",
              new CustomEvent("res_config", {
                detail: {
                  data: { workdir: "test" },
                  requestId: e.detail.requestId,
                },
              }),
            );
          });
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

  const textHookerClient = new TextHookerClient({
    logger,
    bus,
  });
}

main();
