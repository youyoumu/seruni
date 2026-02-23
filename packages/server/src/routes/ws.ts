import type { AppContext } from "#/types/types";
import { Hono } from "hono";

const app = new Hono<{ Variables: { ctx: AppContext } }>();

app.get("/", (c, next) => {
  const ctx = c.get("ctx");
  const { upgradeWebSocket } = ctx;
  const { state, logger, onPayload, addWS, removeWS } = ctx;
  const logWS = logger.child({ name: "ws-client" });

  return upgradeWebSocket(() => {
    return {
      onMessage(e: MessageEvent, ws: unknown) {
        const payload = JSON.parse(e.data.toString());
        onPayload(payload, ws as Parameters<typeof onPayload>[1]);
      },
      onOpen: (_: unknown, ws: unknown) => {
        logWS.info("Connection opened");
        addWS(ws as Parameters<typeof addWS>[0]);
      },
      onClose: (_: unknown, ws: unknown) => {
        logWS.warn("Connection closed");
        state.isListeningTexthooker(false);
        removeWS(ws as Parameters<typeof removeWS>[0]);
      },
    };
  })(c, next);
});

export { app as ws };
