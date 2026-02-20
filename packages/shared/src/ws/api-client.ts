import { type Session, type TextHistory } from "#/db/schema";
import { createCentralBus } from "#/ws-bus";
import type { Push, Request, CreateSchema } from "#/ws-bus";
import { uid } from "uid";
export { WSBusError } from "#/ws-bus";

export type ToastPayload = {
  title?: string;
  description?: string;
  variant?: "default" | "accent" | "success" | "warning" | "danger";
};

export type ToastLoadingPayload = {
  id: string;
  title: string;
  description?: string;
  timeout?: number;
};

export type ToastSuccessPayload = {
  id: string;
  title: string;
  description?: string;
};

export type ToastErrorPayload = {
  id: string;
  title: string;
  description?: string;
};

export type ToastPromiseConfig = {
  id: string;
  loading: string;
  success: string;
  error: string;
};

export type ToastPromiseResolvePayload = {
  id: string;
  data: unknown;
  message?: string;
};

export type ToastPromiseRejectPayload = {
  id: string;
  error: string;
  message?: string;
};

export type ApiSchema = CreateSchema<{
  clientPush: {
    ping: Push;
  };
  serverPush: {
    toast: Push<ToastPayload>;
    toastLoading: Push<ToastLoadingPayload>;
    toastSuccess: Push<ToastSuccessPayload>;
    toastError: Push<ToastErrorPayload>;
    toastPromise: Push<ToastPromiseConfig>;
    toastPromiseResolve: Push<ToastPromiseResolvePayload>;
    toastPromiseReject: Push<ToastPromiseRejectPayload>;
    textHistory: Push<TextHistory>;
    activeSession: Push<Session | null>;
    isListeningTexthooker: Push<boolean>;
    textHookerConnected: Push<boolean>;
    ankiConnectConnected: Push<boolean>;
    obsConnected: Push<boolean>;
  };
  clientRequest: {
    textHistoryBySessionId: Request<number, TextHistory[]>;
    deleteTextHistory: Request<number, TextHistory | null>;
    session: Request<number, Session | null>;
    sessions: Request<undefined, Session[]>;
    createSession: Request<string, Session>;
    deleteSession: Request<number, Session | null>;
    updateSession: Request<Partial<Session>, Session | null>;
    setActiveSession: Request<number, Session | null>;
    getActiveSession: Request<undefined, Session | null>;
    isListeningTexthooker: Request<undefined, boolean>;
    setIsListeningTexthooker: Request<boolean, boolean>;
    textHookerConnected: Request<undefined, boolean>;
    ankiConnectConnected: Request<undefined, boolean>;
    obsConnected: Request<undefined, boolean>;
    checkHealth: Request<undefined, undefined>;
  };
  serverRequest: {
    userAgent: Request<undefined, string>;
  };
}>;

const createApi = () => {
  return createCentralBus<ApiSchema>({
    clientPush: { ping: 0 },
    serverPush: {
      toast: 0,
      toastLoading: 0,
      toastSuccess: 0,
      toastError: 0,
      toastPromise: 0,
      toastPromiseResolve: 0,
      toastPromiseReject: 0,
      textHistory: 0,
      activeSession: 0,
      isListeningTexthooker: 0,
      textHookerConnected: 0,
      ankiConnectConnected: 0,
      obsConnected: 0,
    },
    clientRequest: {
      textHistoryBySessionId: 0,
      deleteTextHistory: 0,
      session: 0,
      sessions: 0,
      createSession: 0,
      deleteSession: 0,
      updateSession: 0,
      setActiveSession: 0,
      getActiveSession: 0,
      isListeningTexthooker: 0,
      setIsListeningTexthooker: 0,
      textHookerConnected: 0,
      ankiConnectConnected: 0,
      obsConnected: 0,
      checkHealth: 0,
    },
    serverRequest: { userAgent: 0 },
  });
};

export type ClientApi = ReturnType<typeof createApi>["client"]["api"];
export function createClientApi() {
  const api = createApi();
  return api.client;
}

export type ServerApi = ReturnType<typeof createApi>["server"]["api"] & {
  toastPromise: <T>(
    promise: () => Promise<T>,
    options: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((error: Error) => string);
    },
  ) => Promise<T>;
};
export function createServerApi() {
  const api = createApi();
  const push = api.server.api.push;

  const toastPromise = async <T>(
    promise: () => Promise<T>,
    options: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((error: Error) => string);
    },
  ): Promise<T> => {
    const id = uid();
    const successMessage = typeof options.success === "function" ? "__fn__" : options.success;
    const errorMessage = typeof options.error === "function" ? "__fn__" : options.error;

    push.toastPromise({
      id,
      loading: options.loading,
      success: successMessage,
      error: errorMessage,
    });

    try {
      const data = await promise();
      const computedSuccessMsg =
        typeof options.success === "function" ? options.success(data) : options.success;
      push.toastPromiseResolve({ id, data, message: computedSuccessMsg });
      return data;
    } catch (error) {
      const err = error instanceof Error ? error : new Error("Unknown error");
      const computedErrorMsg =
        typeof options.error === "function" ? options.error(err) : options.error;
      push.toastPromiseReject({ id, error: err.message, message: computedErrorMsg });
      throw error;
    }
  };

  return {
    ...api.server,
    api: {
      ...api.server.api,
      toastPromise,
    },
  };
}
