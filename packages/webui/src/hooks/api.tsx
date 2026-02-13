import { ReconnectingWebsocket } from "@repo/shared/ws";
import { createContext, useContext, useEffect, useState } from "react";
import { createClientApi } from "@repo/shared/ws";
import type { QueryClient } from "@tanstack/react-query";
import type { TextHistory } from "@repo/shared/db";
import { createKeyring } from "#/util/keyring";
import type { Keyring } from "#/util/keyring";

const { api: clientApi, onPayload, bindWS } = createClientApi();

export class Services {
  api: typeof clientApi;
  keyring: Keyring;
  ws: ReconnectingWebsocket;

  constructor({ queryClient }: { queryClient: QueryClient }) {
    const ws = new ReconnectingWebsocket({
      url: "ws://localhost:45626/ws",
      logger: {
        info: console.log,
        warn: console.log,
      },
    });
    this.ws = ws;
    this.api = clientApi;
    this.keyring = createKeyring(clientApi);

    bindWS(ws);

    ws.addEventListener("message", (e: CustomEventInit) => {
      const payload = JSON.parse(e.detail);
      onPayload(payload);
    });

    this.api.handleRequest.userAgent(() => {
      return navigator.userAgent;
    });

    this.api.handlePush.activeSession((data) => {
      queryClient.setQueryData(this.keyring.sessions.active.queryKey, data);
    });

    this.api.handlePush.textHistory((data) => {
      queryClient.setQueryData(
        this.keyring.textHistory.bySession(data.sessionId).queryKey,
        (old: TextHistory[] = []) => {
          return [...old, data];
        },
      );
    });
  }
}

const ServicesContext = createContext<Services | null>(null);

export const ServicesProvider = ({
  children,
  value,
}: {
  children: React.ReactNode;
  value: Services;
}) => {
  return <ServicesContext.Provider value={value}>{children}</ServicesContext.Provider>;
};

export const useServices = () => {
  const ctx = useContext(ServicesContext);
  if (!ctx) throw new Error("Missing ServicesProvider");
  return ctx;
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
