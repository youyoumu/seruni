import { ReconnectingWebsocket } from "@repo/shared/ws";
import { createContext, useContext } from "react";
import { createClientApi } from "@repo/shared/ws";

const { api, onPayload, bindWS } = createClientApi();

export class Api {
  api = api;
  constructor() {
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
  }
}

const ApiContext = createContext<Api["api"] | null>(null);
export const ApiProvider = ({ children, api }: { children: React.ReactNode; api: Api["api"] }) => {
  return <ApiContext.Provider value={api}>{children}</ApiContext.Provider>;
};
export const useApi = () => {
  const api = useContext(ApiContext);
  if (!api) throw new Error("Missing ApiProvider");
  return api;
};
