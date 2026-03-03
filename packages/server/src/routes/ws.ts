import type { AppContext } from "#/types/types";
import { Hono } from "hono";

const app = new Hono<{ Variables: { ctx: AppContext } }>();

app.get("/", (c, next) => {
  const ctx = c.get("ctx");
  const { upgradeWebSocket } = ctx;
  const { state, onPayload, addWS, removeWS } = ctx;
  const log = ctx.log.child({ name: "ws-client" });

  return upgradeWebSocket(() => {
    return {
      onMessage(e: MessageEvent, ws: unknown) {
        const payload = JSON.parse(e.data.toString());
        onPayload(payload, ws as Parameters<typeof onPayload>[1]);
      },
      onOpen: (_: unknown, ws: unknown) => {
        log.info("Connection opened");
        addWS(ws as Parameters<typeof addWS>[0]);
      },
      onClose: (_: unknown, ws: unknown) => {
        log.warn("Connection closed");
        state.isListeningTextHooker(false);
        removeWS(ws as Parameters<typeof removeWS>[0]);
      },
    };
  })(c, next);
});

export { app as ws };
