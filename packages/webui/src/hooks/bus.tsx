import { ReconnectingWebsocket } from "@repo/shared/ws";
import { type AppEventMap } from "@repo/shared/types";
import { TypedEventTarget } from "typescript-event-target";
import { createContext, useContext } from "react";

const bus = new TypedEventTarget<AppEventMap>();

export type Bus = TypedEventTarget<AppEventMap>;

const ws = new ReconnectingWebsocket({
  url: "ws://localhost:45626/ws",
  logger: {
    info: console.log,
    warn: console.log,
  },
});

ws.addEventListener("message", (e: CustomEventInit) => {
  const payload = JSON.parse(e.detail);
  bus.dispatchTypedEvent(payload.type, new CustomEvent(payload.type, { detail: payload.data }));
});

bus.addEventListener("req_config", (e) => {
  ws.send(JSON.stringify({ type: "req_config", data: e.detail }));
});

const BusContext = createContext(bus);
export const BusProvider = ({ children }: { children: React.ReactNode }) => {
  return <BusContext.Provider value={bus}>{children}</BusContext.Provider>;
};

export const useBus = () => {
  const bus = useContext(BusContext);
  return bus;
};
