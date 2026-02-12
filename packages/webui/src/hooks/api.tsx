import { ReconnectingWebsocket } from "@repo/shared/ws";
import { createContext, useContext, useEffect, useState } from "react";
import { createClientApi } from "@repo/shared/ws";

const { api, onPayload, bindWS } = createClientApi();

export class Api {
  api = api;
  ws: ReconnectingWebsocket;
  constructor() {
    const ws = new ReconnectingWebsocket({
      url: "ws://localhost:45626/ws",
      logger: {
        info: console.log,
        warn: console.log,
      },
    });
    this.ws = ws;

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

const OnlineContext = createContext<boolean | null>(null);
export const OnlineProvider = ({
  children,
  ws,
}: {
  children: React.ReactNode;
  ws: ReconnectingWebsocket;
}) => {
  const [online, setOnline] = useState(false);

  useEffect(() => {
    const openHandler = () => {
      setOnline(true);
    };
    ws.addEventListener("open", openHandler);

    const closeHandler = () => {
      setOnline(false);
    };
    ws.addEventListener("close", closeHandler);

    return () => {
      ws.removeEventListener("open", openHandler);
      ws.removeEventListener("close", closeHandler);
    };
  }, []);

  return <OnlineContext.Provider value={online}>{children}</OnlineContext.Provider>;
};
export const useOnline = () => {
  const online = useContext(OnlineContext);
  if (online === null) throw new Error("Missing OnlineProvider");
  return online;
};
