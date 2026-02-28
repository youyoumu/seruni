import { type Session, type TextHistory } from "#/db/schema";
import { createCentralBus } from "#/ws-bus";
import type { Push, Request, CreateSchema } from "#/ws-bus";
import { R } from "@praha/byethrow";
import { uid } from "uid";
export { WSBusError } from "#/ws-bus";

export type ToastPayload = {
  title?: string;
  description?: string;
  variant?: "default" | "accent" | "success" | "warning" | "danger";
  action?: { id: string; text: string };
};

export type ToastPromiseConfig = {
  id: string;
  loading: { title?: string; description?: string };
};

export type ToastPromiseResolvePayload = {
  id: string;
  title?: string;
  description?: string;
  action?: { id: string; text: string };
};

export type ToastPromiseRejectPayload = {
  id: string;
  title?: string;
  description?: string;
  action?: { id: string; text: string };
};

export type ApiSchema = CreateSchema<{
  clientPush: {
    ping: Push;
    action: Push<string>;
  };
  serverPush: {
    toast: Push<ToastPayload>;
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
    completedTextHistory: Request<undefined, Record<number, number>>;
    markTextHistoryAsCompleted: Request<number, TextHistory | null>;
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
    clientPush: {
      ping: 0,
      action: 0,
    },
    serverPush: {
      toast: 0,
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
      completedTextHistory: 0,
      markTextHistoryAsCompleted: 0,
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
  toastPromise: ToastPromiseFn;
};

type ToastPromiseFn = <TData, TError>(
  promise: () => Promise<R.Result<TData, TError>>,
  options: {
    loading: { title?: string; description?: string };
    success:
      | { title?: string; description?: string }
      | ((data: TData) => { title?: string; description?: string });
    error:
      | { title?: string; description?: string }
      | ((error: TError) => { title?: string; description?: string });
  },
) => Promise<R.Result<TData, TError>>;

export function createServerApi() {
  const api = createApi();
  const push = api.server.api.push;

  const toastPromise: ToastPromiseFn = async (promise, options) => {
    const { loading, success, error } = options;
    const id = uid();
    push.toastPromise({ id, loading });

    const data = await promise();
    if (R.isSuccess(data)) {
      const computedSuccess = typeof success === "function" ? success(data.value) : success;
      push.toastPromiseResolve({ id, ...computedSuccess });
    }
    if (R.isFailure(data)) {
      const computedError = typeof error === "function" ? error(data.error) : error;
      push.toastPromiseReject({ id, ...computedError });
    }
    return data;
  };

  return {
    ...api.server,
    api: {
      ...api.server.api,
      toastPromise,
    },
  };
}
