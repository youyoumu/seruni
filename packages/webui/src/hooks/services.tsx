import { createKeyring } from "#/util/keyring";
import type { Keyring } from "#/util/keyring";
import { createToastStore } from "#/util/toast";
import { createToast } from "#/util/toast";
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
import { throttle } from "es-toolkit";
import { createContext, useContext, useEffect, useState } from "react";

type ServicesEventMap = {
  "textHistory:new": TextHistory;
};

const { api: clientApi, onMessage, onOpen, onClose } = createClientApi();

export class Services {
  api: typeof clientApi;
  keyring: Keyring;
  ws: ReconnectingWebSocket;
  bus = new TypesafeEventTarget<ServicesEventMap>();
  toastStore = createToastStore();
  toast = createToast(this.toastStore);
  #deferredPromises = new Map<
    string,
    {
      resolve: () => void;
      reject: () => void;
      success: { title?: string; description?: string };
      error: { title?: string; description?: string };
      action?: { id: string; text: string };
    }
  >();

  constructor({ queryClient }: { queryClient: QueryClient }) {
    const ws = new ReconnectingWebSocket({
      url: "ws://localhost:45626/ws",
      log: {
        info: console.log,
        warn: console.log,
      },
    });
    this.ws = ws;
    this.api = clientApi;
    this.keyring = createKeyring(clientApi);

    onOpen(ws);

    ws.addListener("close", () => {
      onClose(ws);
    });

    ws.addListener("message", (event) => {
      void onMessage(event, ws);
    });

    this.api.onRequest["user-agent/get"](() => {
      return navigator.userAgent;
    });

    this.api.onPush["session/active/set"]((c) => {
      const data = c.push.body;
      queryClient.setQueryData(this.keyring.session.active.queryKey, data);
    });

    this.api.onPush["text-hooker/listening/set"]((c) => {
      const data = c.push.body;
      queryClient.setQueryData(this.keyring.textHooker.listening.queryKey, data);
    });

    this.api.onPush["text-hooker/auto-resume/set"]((c) => {
      const data = c.push.body;
      queryClient.setQueryData(this.keyring.textHooker.autoResume.queryKey, data);
    });

    this.api.onPush["text-history/create"]((c) => {
      const data = c.push.body;
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

    this.api.onPush["text-hooker/connected/set"]((c) => {
      const data = c.push.body;
      queryClient.setQueryData(this.keyring.textHooker.connected.queryKey, data);
    });

    this.api.onPush["obs/connected/set"]((c) => {
      const data = c.push.body;
      queryClient.setQueryData(this.keyring.obs.connected.queryKey, data);
    });

    const refreshAfkTimerT = throttle(() => this.api.push["timer/afk/refresh"](), 5000);
    document.addEventListener("mousemove", refreshAfkTimerT);

    const createActionProps = (action?: { text: string; id: string }) => {
      if (!action) return undefined;
      return {
        children: action.text,
        onClick: () => {
          this.api.push["action/dispatch"](action.id);
        },
      };
    };

    this.api.onPush["toast/show"]((c) => {
      const data = c.push.body as ToastPayload;
      this.toast(data.title ?? "", {
        description: data.description,
        variant: data.variant ?? "default",
        actionProps: createActionProps(data.action),
      });
    });

    this.api.onPush["toast/promise/start"]((c) => {
      const data = c.push.body as ToastPromiseConfig;
      const { promise, resolve, reject } = Promise.withResolvers<void>();
      this.#deferredPromises.set(data.id, { resolve, reject, success: {}, error: {} });

      const { title, description } = data;

      // NOTE: toast.promise can only show title
      //
      // this.toast.promise(promise, {
      //   loading: title,
      //   success: () => {
      //     const { title } = this.#deferredPromises.get(data.id)?.success ?? {};
      //     return title;
      //   },
      //   error: () => {
      //     const { title } = this.#deferredPromises.get(data.id)?.error ?? {};
      //     return title;
      //   },
      // });

      const id = this.toast(title, {
        description,
        isLoading: true,
        timeout: 0,
        actionProps: createActionProps(data.action),
      });
      void promise
        .then(() => {
          this.toast.close(id);
          const result = this.#deferredPromises.get(data.id);
          this.toast.success(result?.success.title, {
            description: result?.success.description,
            actionProps: createActionProps(result?.action),
          });
        })
        .catch(() => {
          this.toast.close(id);
          const result = this.#deferredPromises.get(data.id);
          this.toast.danger(result?.error.title, {
            description: result?.error.description,
            actionProps: createActionProps(result?.action),
          });
        });
    });

    this.api.onPush["toast/promise/resolve"]((c) => {
      const data = c.push.body as ToastPromiseResolvePayload;
      const result = this.#deferredPromises.get(data.id);
      if (result) {
        result.success.title = data.title;
        result.success.description = data.description;
        result.action = data.action;
        result.resolve();
      }
    });

    this.api.onPush["toast/promise/reject"]((c) => {
      const data = c.push.body as ToastPromiseRejectPayload;
      const result = this.#deferredPromises.get(data.id);
      if (result) {
        result.error.title = data.title;
        result.error.description = data.description;
        result.action = data.action;
        result.reject();
      }
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
