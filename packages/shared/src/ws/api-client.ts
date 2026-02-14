import { type Session, type TextHistory } from "#/db/schema";
import { createCentralBus } from "#/ws-bus";
import type { PushEvent, ReqEvent, ResEvent, CreateSchema } from "#/ws-bus";
export { WSBusError } from "#/ws-bus";

export type ClientPushEventMap = {
  ping: PushEvent;
};
export type ServerPushEventMap = {
  textHistory: PushEvent<TextHistory>;
  activeSession: PushEvent<Session | null>;
  isListeningTexthooker: PushEvent<boolean>;
};

export type ClientReqEventMap = {
  reqTextHistoryBySessionId: ReqEvent<number>;
  reqDeleteTextHistory: ReqEvent<number>;
  reqSession: ReqEvent<number>;
  reqSessions: ReqEvent;
  reqCreateSession: ReqEvent<string>;
  reqDeleteSession: ReqEvent<number>;
  reqUpdateSession: ReqEvent<Partial<Session>>;
  reqSetActiveSession: ReqEvent<number>;
  reqGetActiveSession: ReqEvent;
  reqIsListeningTexthooker: ReqEvent;
  reqSetIsListeningTexthooker: ReqEvent<boolean>;
  reqCheckHealth: ReqEvent;
};
export type ServerResEventMap = {
  resTextHistoryBySessionId: ResEvent<TextHistory[]>;
  resDeleteTextHistory: ResEvent<TextHistory | null>;
  resSession: ResEvent<Session | null>;
  resSessions: ResEvent<Session[]>;
  resCreateSession: ResEvent<Session>;
  resDeleteSession: ResEvent<Session | null>;
  resUpdateSession: ResEvent<Session | null>;
  resSetActiveSession: ResEvent<Session | null>;
  resGetActiveSession: ResEvent<Session | null>;
  resIsListeningTexthooker: ResEvent<boolean>;
  resSetIsListeningTexthooker: ResEvent<boolean>;
  resCheckHealth: ResEvent;
};

export type ServerReqEventMap = {
  reqUserAgent: ReqEvent;
};
export type ClientResEventMap = {
  resUserAgent: ResEvent<string>;
};

type ApiSchema = CreateSchema<{
  clientPush: ClientPushEventMap;
  serverPush: ServerPushEventMap;
  clientRequest: ClientReqEventMap;
  serverRespond: ServerResEventMap;
  serverRequest: ServerReqEventMap;
  clientRespond: ClientResEventMap;
}>;

const createApi = () => {
  const { bridge, link } = createCentralBus<ApiSchema>();

  const createClientPushPair = () => {
    const push = link.client.push;
    const [ping, handlePing] = push("ping");
    return {
      push: {
        ping,
      },
      handlePush: {
        ping: handlePing,
      },
    };
  };
  const clientPushPair = createClientPushPair();

  //oxfmt-ignore
  const createClientRequestPair = () => {
    const request = link.client.request;
    const [textHistoryBySessionId, handleTextHistoryBySessionId] = request( "reqTextHistoryBySessionId", "resTextHistoryBySessionId",);
    const [deleteTextHistory, handleDeleteTextHistory] = request( "reqDeleteTextHistory", "resDeleteTextHistory",);
    const [session, handleSession] = request("reqSession", "resSession");
    const [sessions, handleSessions] = request("reqSessions", "resSessions");
    const [createSession, handleCreateSession] = request("reqCreateSession", "resCreateSession");
    const [deleteSession, handleDeleteSession] = request("reqDeleteSession", "resDeleteSession");
    const [updateSession, handleUpdateSession] = request( "reqUpdateSession", "resUpdateSession",);
    const [setActiveSession, handleSetActiveSession] = request( "reqSetActiveSession", "resSetActiveSession",);
    const [getActiveSession, handleGetActiveSession] = request( "reqGetActiveSession", "resGetActiveSession",);
    const [isListeningTexthooker, handleIsListeningTexthooker] = request( "reqIsListeningTexthooker", "resIsListeningTexthooker",);
    const [setIsListeningTexthooker, handleSetIsListeningTexthooker] = request( "reqSetIsListeningTexthooker", "resSetIsListeningTexthooker",);
    const [checkHealth, handleCheckHealth] = request("reqCheckHealth", "resCheckHealth");

    return {
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
    };
  };
  const clientRequestPair = createClientRequestPair();

  const createServerPushPair = () => {
    const push = link.server.push;
    const [textHistory, handleTextHistory] = push("textHistory");
    const [activeSession, handleActiveSession] = push("activeSession");
    const [isListeningTexthooker, handleIsListeningTexthooker] = push("isListeningTexthooker");

    return {
      push: {
        textHistory,
        activeSession,
        isListeningTexthooker,
      },
      handlePush: {
        textHistory: handleTextHistory,
        activeSession: handleActiveSession,
        isListeningTexthooker: handleIsListeningTexthooker,
      },
    };
  };
  const serverPushPair = createServerPushPair();

  const createServerRequestPair = () => {
    const request = link.server.request;
    const [userAgent, handleUserAgent] = request("reqUserAgent", "resUserAgent");
    return {
      request: {
        userAgent,
      },
      handleRequest: {
        userAgent: handleUserAgent,
      },
    };
  };
  const serverRequestPair = createServerRequestPair();

  return {
    client: {
      onPayload: bridge.client.onPayload,
      bindWS: bridge.client.bindWS,
      api: {
        push: clientPushPair.push,
        request: clientRequestPair.request,
        handlePush: serverPushPair.handlePush,
        handleRequest: serverRequestPair.handleRequest,
      },
    },
    server: {
      onPayload: bridge.server.onPayload,
      addWS: bridge.server.addWS,
      removeWS: bridge.server.removeWS,
      api: {
        push: serverPushPair.push,
        request: serverRequestPair.request,
        handlePush: clientPushPair.handlePush,
        handleRequest: clientRequestPair.handleRequest,
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
