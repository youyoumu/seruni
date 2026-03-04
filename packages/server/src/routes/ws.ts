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
      onMessage(e: MessageEvent, ws) {
        const payload = JSON.parse(e.data.toString());
        void onPayload(payload, ws);
      },
      onOpen: (_, ws) => {
        log.info("Connection opened");
        addWS(ws as Parameters<typeof addWS>[0]);
      },
      onClose: (_, ws) => {
        log.warn("Connection closed");
        state.isListeningTextHooker(false);
        removeWS(ws);
      },
    };
  })(c, next);
});

export { app as ws };
