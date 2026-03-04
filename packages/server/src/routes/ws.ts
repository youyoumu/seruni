import type { AppContext } from "#/types/types";
import { Hono } from "hono";

const app = new Hono<{ Variables: { ctx: AppContext } }>();

app.get("/", (c, next) => {
  const ctx = c.get("ctx");
  const { upgradeWebSocket } = ctx;
  const { state, onMessage, addWS, removeWS } = ctx;
  const log = ctx.log.child({ name: "ws-client" });

  return upgradeWebSocket(() => {
    return {
      onMessage(e, ws) {
        void onMessage(e, ws);
      },
      onOpen: (_, ws) => {
        log.info("Connection opened");
        addWS(ws);
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
