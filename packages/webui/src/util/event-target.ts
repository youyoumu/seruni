import { ReconnectingWebsocket } from "@repo/shared/ws";
import { type AppEventMap } from "@repo/shared/types";
import { TypedEventTarget } from "typescript-event-target";

export const eventTarget = new TypedEventTarget<AppEventMap>();

const ws = new ReconnectingWebsocket({
  url: "ws://localhost:45626/ws",
  logger: {
    info: console.log,
    warn: console.log,
  },
});

ws.addEventListener("message", (e: CustomEventInit) => {
  const payload = JSON.parse(e.detail);
  eventTarget.dispatchTypedEvent(
    payload.type,
    new CustomEvent(payload.type, { detail: payload.data }),
  );
});
