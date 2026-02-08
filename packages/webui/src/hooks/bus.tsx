import { ReconnectingWebsocket } from "@repo/shared/ws";
import { createContext, useContext } from "react";
import { createClientApi } from "@repo/shared/ws";

const { clientApi, setupWSForwarder, onPayload } = createClientApi();
const api = clientApi;

const ws = new ReconnectingWebsocket({
  url: "ws://localhost:45626/ws",
  logger: {
    info: console.log,
    warn: console.log,
  },
});

ws.addEventListener("message", (e: CustomEventInit) => {
  const payload = JSON.parse(e.detail);
  onPayload(payload);
});

ws.addEventListener("open", (e: CustomEventInit) => {
  setupWSForwarder(ws);
});

api.addReqHandler("req_user_agent", () => {
  return navigator.userAgent;
});

const BusContext = createContext(clientApi);
export const BusProvider = ({ children }: { children: React.ReactNode }) => {
  return <BusContext.Provider value={clientApi}>{children}</BusContext.Provider>;
};
export const useBus = () => {
  return useContext(BusContext);
};
