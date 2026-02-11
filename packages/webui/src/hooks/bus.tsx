import { ReconnectingWebsocket } from "@repo/shared/ws";
import { createContext, useContext } from "react";
import { createClientApi } from "@repo/shared/ws";

const { api, onPayload, bindWS } = createClientApi();

const ws = new ReconnectingWebsocket({
  url: "ws://localhost:45626/ws",
  logger: {
    info: console.log,
    warn: console.log,
  },
});

bindWS(ws);

ws.addEventListener("message", (e: CustomEventInit) => {
  const payload = JSON.parse(e.detail);
  onPayload(payload);
});

api.handleRequest.userAgent(() => {
  return navigator.userAgent;
});

//TODO: rename to api
const BusContext = createContext(api);
export const BusProvider = ({ children }: { children: React.ReactNode }) => {
  return <BusContext.Provider value={api}>{children}</BusContext.Provider>;
};
export const useBus = () => {
  return useContext(BusContext);
};
