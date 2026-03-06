import type { AppContext } from "#/types/types";
import { Hono } from "hono";

const app = new Hono<{ Variables: { ctx: AppContext } }>();

app.get("/", (c, next) => {
  const ctx = c.get("ctx");
  const { upgradeWebSocket } = ctx;
  const { state, onMessage, onOpen, onClose } = ctx;
  const log = ctx.log.child({ name: "ws-client" });

  return upgradeWebSocket(() => {
    return {
      onMessage(e, ws) {
        void onMessage(e, ws);
      },
      onOpen: (_, ws) => {
        log.info("Connection opened");
        onOpen(ws);
      },
      onClose: (_, ws) => {
        log.warn("Connection closed");
        state.isListeningTextHooker(false);
        onClose(ws);
      },
    };
  })(c, next);
});

export { app as ws };
