import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { TextHookerClient } from "./client/text-hooker.client";
import { createLogger } from "./util/logger";
import { type WSPayload } from "@repo/shared/ws";
import {
  type ClientReqEventMap,
  type ClientResEventMap,
  type ServerPushEventMap,
} from "@repo/shared/types";

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
          const payload: WSPayload = JSON.parse(e.data.toString());
          if (payload.type === "req") {
            const tag = payload.tag as keyof ClientReqEventMap;
            const data = payload.data as ClientReqEventMap[keyof ClientReqEventMap]["detail"];
            bus.req.client.dispatchTypedEvent(tag, new CustomEvent(tag, { detail: data }));
          }
          if (payload.type === "res") {
            const tag = payload.tag as keyof ClientResEventMap;
            const data = payload.data as ClientResEventMap[keyof ClientResEventMap]["detail"];
            bus.res.client.dispatchTypedEvent(tag, new CustomEvent(tag, { detail: data }));
          }
          if (payload.type === "push") {
            const tag = payload.tag as keyof ServerPushEventMap;
            const data = payload.data as ServerPushEventMap[keyof ServerPushEventMap]["detail"];
            bus.push.server.dispatchTypedEvent(tag, new CustomEvent(tag, { detail: data }));
          }
        },
        onOpen: (_, ws) => {
          log.info("Connection opened");

          bus.push.server.addEventListener("text_history", (e) => {
            const payload: WSPayload = {
              type: "push",
              tag: "text_history",
              data: e.detail,
            };
            ws.send(JSON.stringify(payload));
          });

          bus.res.server.addEventListener("res_config", (e) => {
            const payload: WSPayload = {
              type: "res",
              tag: "res_config",
              data: e.detail,
            };
            ws.send(JSON.stringify(payload));
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
