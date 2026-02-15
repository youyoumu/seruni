import { type Session, type TextHistory } from "#/db/schema";
import { createCentralBus } from "#/ws-bus";
import type { Push, Request, CreateSchema } from "#/ws-bus";
export { WSBusError } from "#/ws-bus";

export type ApiSchema = CreateSchema<{
  clientPush: {
    ping: Push;
  };
  serverPush: {
    textHistory: Push<TextHistory>;
    activeSession: Push<Session | null>;
    isListeningTexthooker: Push<boolean>;
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
    checkHealth: Request<undefined, undefined>;
  };
  serverRequest: {
    userAgent: Request<undefined, string>;
  };
}>;

const createApi = () => {
  return createCentralBus<ApiSchema>({
    clientPush: { ping: undefined },
    serverPush: {
      textHistory: undefined,
      activeSession: undefined,
      isListeningTexthooker: undefined,
    },
    clientRequest: {
      textHistoryBySessionId: undefined,
      deleteTextHistory: undefined,
      session: undefined,
      sessions: undefined,
      createSession: undefined,
      deleteSession: undefined,
      updateSession: undefined,
      setActiveSession: undefined,
      getActiveSession: undefined,
      isListeningTexthooker: undefined,
      setIsListeningTexthooker: undefined,
      checkHealth: undefined,
    },
    serverRequest: { userAgent: undefined },
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
