import { createKeyring } from "#/util/keyring";
import type { Keyring } from "#/util/keyring";
import { toast } from "@heroui/react";
import type { TextHistory } from "@repo/shared/db";
import { TypesafeEventTarget } from "@repo/shared/util";
import type {
  ToastPayload,
  ToastPromiseConfig,
  ToastPromiseResolvePayload,
  ToastPromiseRejectPayload,
} from "@repo/shared/ws";
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
  #deferredPromises = new Map<
    string,
    {
      resolve: (value: unknown) => void;
      reject: (error: Error) => void;
      successMessage?: string;
      errorMessage?: string;
    }
  >();

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

    this.api.onPush.obsConnected((data) => {
      queryClient.setQueryData(this.keyring.client.obsConnected.queryKey, data);
    });

    this.api.onPush.toast((data: ToastPayload) => {
      toast(data.title ?? "", {
        description: data.description,
        variant: data.variant,
      });
    });

    this.api.onPush.toastPromise((data: ToastPromiseConfig) => {
      const { promise, resolve, reject } = Promise.withResolvers<unknown>();
      this.#deferredPromises.set(data.id, {
        resolve,
        reject,
        successMessage: data.success,
        errorMessage: data.error,
      });

      toast.promise(promise, {
        loading: data.loading,
        success: (resolvedData) => {
          const deferred = this.#deferredPromises.get(data.id);
          const msg = deferred?.successMessage;
          this.#deferredPromises.delete(data.id);
          if (msg && msg !== "__fn__") return msg;
          return typeof resolvedData === "object"
            ? JSON.stringify(resolvedData)
            : String(resolvedData);
        },
        error: (err) => {
          const deferred = this.#deferredPromises.get(data.id);
          const msg = deferred?.errorMessage;
          this.#deferredPromises.delete(data.id);
          if (msg && msg !== "__fn__") return msg;
          return err.message;
        },
      });
    });

    this.api.onPush.toastPromiseResolve((data: ToastPromiseResolvePayload) => {
      const deferred = this.#deferredPromises.get(data.id);
      if (deferred) {
        if (data.message) {
          deferred.successMessage = data.message;
        }
        deferred.resolve(data.data);
      }
    });

    this.api.onPush.toastPromiseReject((data: ToastPromiseRejectPayload) => {
      const deferred = this.#deferredPromises.get(data.id);
      if (deferred) {
        if (data.message) {
          deferred.errorMessage = data.message;
        }
        deferred.reject(new Error(data.error));
      }
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
