import { createKeyring } from "#/util/keyring";
import type { Keyring } from "#/util/keyring";
import type { TextHistory } from "@repo/shared/db";
import { TypesafeEventTarget } from "@repo/shared/util";
import { ReconnectingWebSocket } from "@repo/shared/ws";
import { createClientApi } from "@repo/shared/ws";
import type { QueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useState } from "react";

type ServicesEventMap = {
  "textHistory:new": TextHistory;
};

const { api: clientApi, onPayload, bindWS } = createClientApi();

export class Services {
  api: typeof clientApi;
  keyring: Keyring;
  ws: ReconnectingWebSocket;
  bus = new TypesafeEventTarget<ServicesEventMap>();

  constructor({ queryClient }: { queryClient: QueryClient }) {
    const ws = new ReconnectingWebSocket({
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

    ws.addListener("message", (detail) => {
      if (typeof detail !== "string") return;
      const payload = JSON.parse(detail);
      onPayload(payload);
    });

    this.api.onRequest.userAgent(() => {
      return navigator.userAgent;
    });

    this.api.onPush.activeSession((data) => {
      queryClient.setQueryData(this.keyring.sessions.active.queryKey, data);
    });

    this.api.onPush.isListeningTexthooker((data) => {
      queryClient.setQueryData(this.keyring.isListeningTexthooker.isListening.queryKey, data);
    });

    this.api.onPush.textHistory((data) => {
      const old = queryClient.getQueryData(
        this.keyring.textHistory.bySession(data.sessionId).queryKey,
      );
      if (old) {
        queryClient.setQueryData(
          this.keyring.textHistory.bySession(data.sessionId).queryKey,
          (old: TextHistory[] = []) => {
            return [...old, data];
          },
        );
        this.bus.dispatch("textHistory:new", data);
      }
    });

    this.api.onPush.textHookerConnected((data) => {
      queryClient.setQueryData(this.keyring.client.textHookerConnected.queryKey, data);
    });

    this.api.onPush.ankiConnectConnected((data) => {
      queryClient.setQueryData(this.keyring.client.ankiConnectConnected.queryKey, data);
    });

    this.api.onPush.obsConnected((data) => {
      queryClient.setQueryData(this.keyring.client.obsConnected.queryKey, data);
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
  ws: ReconnectingWebSocket;
}) => {
  const [online, setOnline] = useState(false);

  useEffect(() => {
    const cleanOpen = ws.addListener("open", () => {
      setOnline(true);
    });

    const cleanClose = ws.addListener("close", () => {
      setOnline(false);
    });

    return () => {
      cleanOpen();
      cleanClose();
    };
  }, [ws]);

  return <OnlineContext.Provider value={online}>{children}</OnlineContext.Provider>;
};

export const useOnline = () => {
  const online = useContext(OnlineContext);
  if (online === null) throw new Error("Missing OnlineProvider");
  return online;
};
