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
  const { bridge, link } = createCentralBus<ApiSchema>();

  const ping = link.client.push("ping");

  const textHistoryBySessionId = link.client.request("textHistoryBySessionId");
  const deleteTextHistory = link.client.request("deleteTextHistory");
  const session = link.client.request("session");
  const sessions = link.client.request("sessions");
  const createSession = link.client.request("createSession");
  const deleteSession = link.client.request("deleteSession");
  const updateSession = link.client.request("updateSession");
  const setActiveSession = link.client.request("setActiveSession");
  const getActiveSession = link.client.request("getActiveSession");
  const isListeningTexthooker = link.client.request("isListeningTexthooker");
  const setIsListeningTexthooker = link.client.request("setIsListeningTexthooker");
  const checkHealth = link.client.request("checkHealth");

  const textHistory = link.server.push("textHistory");
  const activeSession = link.server.push("activeSession");
  const isListeningTexthookerPush = link.server.push("isListeningTexthooker");

  const userAgent = link.server.request("userAgent");

  return {
    client: {
      onPayload: bridge.client.onPayload,
      bindWS: bridge.client.bindWS,
      api: {
        push: { ping: ping.push },
        request: {
          textHistoryBySessionId: textHistoryBySessionId.request,
          deleteTextHistory: deleteTextHistory.request,
          session: session.request,
          sessions: sessions.request,
          createSession: createSession.request,
          deleteSession: deleteSession.request,
          updateSession: updateSession.request,
          setActiveSession: setActiveSession.request,
          getActiveSession: getActiveSession.request,
          isListeningTexthooker: isListeningTexthooker.request,
          setIsListeningTexthooker: setIsListeningTexthooker.request,
          checkHealth: checkHealth.request,
        },
        handlePush: {
          textHistory: textHistory.handle,
          activeSession: activeSession.handle,
          isListeningTexthooker: isListeningTexthookerPush.handle,
        },
        handleRequest: {
          userAgent: userAgent.handle,
        },
      },
    },
    server: {
      onPayload: bridge.server.onPayload,
      addWS: bridge.server.addWS,
      removeWS: bridge.server.removeWS,
      api: {
        push: {
          textHistory: textHistory.push,
          activeSession: activeSession.push,
          isListeningTexthooker: isListeningTexthookerPush.push,
        },
        request: { userAgent: userAgent.request },
        handlePush: { ping: ping.handle },
        handleRequest: {
          textHistoryBySessionId: textHistoryBySessionId.handle,
          deleteTextHistory: deleteTextHistory.handle,
          session: session.handle,
          sessions: sessions.handle,
          createSession: createSession.handle,
          deleteSession: deleteSession.handle,
          updateSession: updateSession.handle,
          setActiveSession: setActiveSession.handle,
          getActiveSession: getActiveSession.handle,
          isListeningTexthooker: isListeningTexthooker.handle,
          setIsListeningTexthooker: setIsListeningTexthooker.handle,
          checkHealth: checkHealth.handle,
        },
      },
    },
  };
};

export type ClientApi = ReturnType<typeof createClientApi>["api"];
export function createClientApi() {
  const { client } = createApi();
  return client;
}

export type ServerApi = ReturnType<typeof createServerApi>["api"];
export function createServerApi() {
  const { server } = createApi();
  return server;
}
