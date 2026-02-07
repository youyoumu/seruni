import { ReconnectingWebsocket, type WSPayload } from "@repo/shared/ws";
import { createContext, useContext } from "react";
import { clientOnMessage, createBusCenter, clientOnOpen } from "@repo/shared/events";

const bus = createBusCenter();
const api = bus.client.api;

const ws = new ReconnectingWebsocket({
  url: "ws://localhost:45626/ws",
  logger: {
    info: console.log,
    warn: console.log,
  },
});

ws.addEventListener("message", (e: CustomEventInit) => {
  const payload: WSPayload = JSON.parse(e.detail);
  clientOnMessage(payload, bus);
});

ws.addEventListener("open", (e: CustomEventInit) => {
  clientOnOpen(bus, ws);
});

api.addReqHandler("req_user_agent", () => {
  return navigator.userAgent;
});

const BusContext = createContext(bus);
export const BusProvider = ({ children }: { children: React.ReactNode }) => {
  return <BusContext.Provider value={bus}>{children}</BusContext.Provider>;
};
export const useBus = () => {
  return useContext(BusContext);
};
