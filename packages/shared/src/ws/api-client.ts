import { createCentralBus } from "#/events";
import { type Session, type TextHistory } from "#/db/schema";
import type { PushEvent, ReqEvent, ResEvent, CreateSchema } from "#/events";

export type Config = {
  workdir: string;
};

export type ClientPushEventMap = {
  ping: PushEvent;
  ping2: PushEvent<number>;
};
export type ServerPushEventMap = {
  textHistory: PushEvent<TextHistory>;
  textHistory2: PushEvent;
};

export type ClientReqEventMap = {
  reqConfig: ReqEvent;
  reqTextHistoryBySessionId: ReqEvent<number>;
  reqSessions: ReqEvent;
};
export type ServerResEventMap = {
  resConfig: ResEvent<Config>;
  resTextHistoryBySessionId: ResEvent<TextHistory[]>;
  resSessions: ResEvent<Session[]>;
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
  const {
    linkClientPush,
    linkClientRequest,
    linkServerPush,
    linkServerRequest,
    clientWSBridge,
    serverWSBridge,
  } = createCentralBus<ApiSchema>();

  const createClientPushPair = () => {
    const [ping, handlePing] = linkClientPush("ping");
    const [ping2, handlePing2] = linkClientPush("ping2");
    return {
      push: {
        ping,
        ping2,
      },
      handlePush: {
        ping: handlePing,
        ping2: handlePing2,
      },
    };
  };
  const clientPushPair = createClientPushPair();

  const createClientRequestPair = () => {
    const [config, handleConfig] = linkClientRequest("reqConfig", "resConfig");
    const [textHistoryBySessionId, handleTextHistoryBySessionId] = linkClientRequest(
      "reqTextHistoryBySessionId",
      "resTextHistoryBySessionId",
    );
    const [sessions, handleSessions] = linkClientRequest("reqSessions", "resSessions");

    return {
      request: {
        config,
        textHistoryBySessionId,
        sessions,
      },
      handleRequest: {
        config: handleConfig,
        textHistoryBySessionId: handleTextHistoryBySessionId,
        sessions: handleSessions,
      },
    };
  };
  const clientRequestPair = createClientRequestPair();

  const createServerPushPair = () => {
    const [textHistory, handleTextHistory] = linkServerPush("textHistory");
    const [textHistory2, handleTextHistory2] = linkServerPush("textHistory2");

    return {
      push: {
        textHistory,
        textHistory2,
      },
      handlePush: {
        textHistory: handleTextHistory,
        textHistory2: handleTextHistory2,
      },
    };
  };
  const serverPushPair = createServerPushPair();

  const createServerRequestPair = () => {
    const [userAgent, handleUserAgent] = linkServerRequest("reqUserAgent", "resUserAgent");
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
      push: clientPushPair.push,
      request: clientRequestPair.request,
      handlePush: serverPushPair.handlePush,
      handleRequest: serverRequestPair.handleRequest,
    },
    server: {
      push: serverPushPair.push,
      request: serverRequestPair.request,
      handlePush: clientPushPair.handlePush,
      handleRequest: clientRequestPair.handleRequest,
    },
    clientWSBridge,
    serverWSBridge,
  };
};

export type ClientApi = ReturnType<typeof createClientApi>["api"];
export function createClientApi() {
  const { client, clientWSBridge } = createApi();
  return {
    api: client,
    wsBridge: clientWSBridge,
  };
}

export type ServerApi = ReturnType<typeof createServerApi>["api"];
export function createServerApi() {
  const { server, serverWSBridge } = createApi();
  return {
    api: server,
    wsBridge: serverWSBridge,
  };
}
