import { ReconnectingWebsocket } from "@repo/shared/ws";
import { createContext, useContext } from "react";
import { createClientApi } from "@repo/shared/ws";

const { api, wsBridge } = createClientApi();

const ws = new ReconnectingWebsocket({
  url: "ws://localhost:45626/ws",
  logger: {
    info: console.log,
    warn: console.log,
  },
});

wsBridge.bindWS(ws);

ws.addEventListener("message", (e: CustomEventInit) => {
  const payload = JSON.parse(e.detail);
  wsBridge.onPayload(payload);
});

api.addReqHandler("req_user_agent", () => {
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
