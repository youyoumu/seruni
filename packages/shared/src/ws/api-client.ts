import { type Session, type TextHistory } from "#/db/schema";
import { createCentralBus } from "#/ws-bus";
import type { Push, Request, CreateSchema } from "#/ws-bus";
export { WSBusError } from "#/ws-bus";

// Simplified schema definition with Request pairs
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
    // Single definition per request - defines both request and response types
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

  // Client pushes - simplified
  const [ping, onPing] = link.client.push("ping");

  // Client requests - single call per endpoint
  const [textHistoryBySessionId, handleTextHistoryBySessionId] =
    link.client.request("textHistoryBySessionId");
  const [deleteTextHistory, handleDeleteTextHistory] = link.client.request("deleteTextHistory");
  const [session, handleSession] = link.client.request("session");
  const [sessions, handleSessions] = link.client.request("sessions");
  const [createSession, handleCreateSession] = link.client.request("createSession");
  const [deleteSession, handleDeleteSession] = link.client.request("deleteSession");
  const [updateSession, handleUpdateSession] = link.client.request("updateSession");
  const [setActiveSession, handleSetActiveSession] = link.client.request("setActiveSession");
  const [getActiveSession, handleGetActiveSession] = link.client.request("getActiveSession");
  const [isListeningTexthooker, handleIsListeningTexthooker] =
    link.client.request("isListeningTexthooker");
  const [setIsListeningTexthooker, handleSetIsListeningTexthooker] = link.client.request(
    "setIsListeningTexthooker",
  );
  const [checkHealth, handleCheckHealth] = link.client.request("checkHealth");

  // Server pushes
  const [textHistory, onTextHistory] = link.server.push("textHistory");
  const [activeSession, onActiveSession] = link.server.push("activeSession");
  const [isListeningTexthookerPush, onIsListeningTexthooker] =
    link.server.push("isListeningTexthooker");

  // Server requests
  const [userAgent, handleUserAgent] = link.server.request("userAgent");

  return {
    client: {
      onPayload: bridge.client.onPayload,
      bindWS: bridge.client.bindWS,
      api: {
        push: { ping },
        request: {
          textHistoryBySessionId,
          deleteTextHistory,
          session,
          sessions,
          createSession,
          deleteSession,
          updateSession,
          setActiveSession,
          getActiveSession,
          isListeningTexthooker,
          setIsListeningTexthooker,
          checkHealth,
        },
        handlePush: {
          textHistory: onTextHistory,
          activeSession: onActiveSession,
          isListeningTexthooker: onIsListeningTexthooker,
        },
        handleRequest: {
          userAgent: handleUserAgent,
        },
      },
    },
    server: {
      onPayload: bridge.server.onPayload,
      addWS: bridge.server.addWS,
      removeWS: bridge.server.removeWS,
      api: {
        push: {
          textHistory,
          activeSession,
          isListeningTexthooker: isListeningTexthookerPush,
        },
        request: { userAgent },
        handlePush: { ping: onPing },
        handleRequest: {
          textHistoryBySessionId: handleTextHistoryBySessionId,
          deleteTextHistory: handleDeleteTextHistory,
          session: handleSession,
          sessions: handleSessions,
          createSession: handleCreateSession,
          deleteSession: handleDeleteSession,
          updateSession: handleUpdateSession,
          setActiveSession: handleSetActiveSession,
          getActiveSession: handleGetActiveSession,
          isListeningTexthooker: handleIsListeningTexthooker,
          setIsListeningTexthooker: handleSetIsListeningTexthooker,
          checkHealth: handleCheckHealth,
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
