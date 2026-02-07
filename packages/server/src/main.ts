import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { TextHookerClient } from "./client/text-hooker.client";
import { createLogger } from "./util/logger";
import { type WSPayload } from "@repo/shared/ws";
import {
  CLIENT_REQ_MAP,
  SERVER_PUSH_MAP,
  SERVER_REQ_MAP,
  type ClientPushEventMap,
  type ClientReqEventMap,
  type ClientResEventMap,
  type ServerPushEventMap,
  type ServerReqEventMap,
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

  setInterval(async () => {
    const userAgent = await bus.server.req.request("req_user_agent");
    console.log("DEBUG[1514]: userAgent=", userAgent);
  }, 3000);

  app.get(
    "/ws",
    upgradeWebSocket(() => {
      return {
        onMessage(e, ws) {
          const payload: WSPayload = JSON.parse(e.data.toString());
          if (payload.type === "req") {
            const tag = payload.tag as keyof ClientReqEventMap;
            const data = payload.data as ClientReqEventMap[keyof ClientReqEventMap]["detail"];
            bus.client.req.dispatchTypedEvent(tag, new CustomEvent(tag, { detail: data }));
          }
          if (payload.type === "res") {
            const tag = payload.tag as keyof ClientResEventMap;
            const data = payload.data as ClientResEventMap[keyof ClientResEventMap]["detail"];
            bus.client.res.dispatchTypedEvent(tag, new CustomEvent(tag, { detail: data }));
          }
          if (payload.type === "push") {
            const tag = payload.tag as keyof ClientPushEventMap;
            const data = payload.data as ClientPushEventMap[keyof ClientPushEventMap]["detail"];
            bus.client.push.dispatchTypedEvent(tag, new CustomEvent(tag, { detail: data }));
          }
        },
        onOpen: (_, ws) => {
          log.info("Connection opened");

          Object.keys(SERVER_REQ_MAP).forEach((key) => {
            const tag = key as keyof ServerReqEventMap;
            bus.server.req.addEventListener(tag, (e) => {
              const payload: WSPayload = {
                type: "req",
                tag: tag,
                data: e.detail,
              };
              ws.send(JSON.stringify(payload));
            });
          });

          Object.keys(SERVER_PUSH_MAP).forEach((key) => {
            const tag = key as keyof ServerPushEventMap;
            bus.server.push.addEventListener(tag, (e) => {
              const payload: WSPayload = {
                type: "push",
                tag: tag,
                data: e.detail,
              };
              ws.send(JSON.stringify(payload));
            });
          });

          Object.values(CLIENT_REQ_MAP).forEach((key) => {
            bus.server.res.addEventListener(key, (e) => {
              const payload: WSPayload = {
                type: "res",
                tag: key,
                data: e.detail,
              };
              ws.send(JSON.stringify(payload));
            });
          });

          bus.client.req.addEventListener("req_config", (e) => {
            bus.server.res.dispatchTypedEvent(
              "res_config",
              new CustomEvent("res_config", {
                detail: {
                  data: { workdir: "test" },
                  requestId: e.detail.requestId,
                },
              }),
            );
          });

          bus.client.push.addEventListener("ping", (e) => {
            console.log("DEBUG[1537]: e=", e.type);
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
