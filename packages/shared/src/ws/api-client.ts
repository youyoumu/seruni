import { createCentralBus } from "#/ws-bus";
import { type Session, type TextHistory } from "#/db/schema";
import type { PushEvent, ReqEvent, ResEvent, CreateSchema } from "#/ws-bus";
export { WSBusError } from "#/ws-bus";

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
  reqSession: ReqEvent<number>;
  reqSessions: ReqEvent;
};
export type ServerResEventMap = {
  resConfig: ResEvent<Config>;
  resTextHistoryBySessionId: ResEvent<TextHistory[]>;
  resSession: ResEvent<Session | undefined>;
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
  const { bridge, link } = createCentralBus<ApiSchema>();

  const createClientPushPair = () => {
    const push = link.client.push;
    const [ping, handlePing] = push("ping");
    const [ping2, handlePing2] = push("ping2");
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
    const request = link.client.request;
    const [config, handleConfig] = request("reqConfig", "resConfig");
    const [textHistoryBySessionId, handleTextHistoryBySessionId] = request(
      "reqTextHistoryBySessionId",
      "resTextHistoryBySessionId",
    );
    const [session, handleSession] = request("reqSession", "resSession");
    const [sessions, handleSessions] = request("reqSessions", "resSessions");

    return {
      request: {
        config,
        textHistoryBySessionId,
        session,
        sessions,
      },
      handleRequest: {
        config: handleConfig,
        textHistoryBySessionId: handleTextHistoryBySessionId,
        session: handleSession,
        sessions: handleSessions,
      },
    };
  };
  const clientRequestPair = createClientRequestPair();

  const createServerPushPair = () => {
    const push = link.server.push;
    const [textHistory, handleTextHistory] = push("textHistory");
    const [textHistory2, handleTextHistory2] = push("textHistory2");

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
