import { type Session, type TextHistory } from "#/db/schema";
import { createCentralBus } from "#/ws-bus";
import type { Push, Request, CreateSchema } from "#/ws-bus";
export { WSBusError } from "#/ws-bus";

export type ToastPayload = {
  title?: string;
  description?: string;
  variant?: "default" | "accent" | "success" | "warning" | "danger";
};

export type ApiSchema = CreateSchema<{
  clientPush: {
    ping: Push;
  };
  serverPush: {
    toast: Push<ToastPayload>;
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

export type ServerApi = ReturnType<typeof createApi>["server"]["api"];
export function createServerApi() {
  const api = createApi();
  return api.server;
}
