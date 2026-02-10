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
  text_history: PushEvent<TextHistory>;
  text_history2: PushEvent;
};

export type ClientReqEventMap = {
  req_config: ReqEvent;
  req_text_history_by_session_id: ReqEvent<number>;
  req_sessions: ReqEvent;
};
export type ServerResEventMap = {
  res_config: ResEvent<Config>;
  res_text_history_by_session_id: ResEvent<TextHistory[]>;
  res_sessions: ResEvent<Session[]>;
};

export type ServerReqEventMap = {
  req_user_agent: ReqEvent;
};
export type ClientResEventMap = {
  res_user_agent: ResEvent<string>;
};

type ApiSchema = CreateSchema<{
  clientPush: ClientPushEventMap;
  serverPush: ServerPushEventMap;
  clientRequest: ClientReqEventMap;
  serverRespond: ServerResEventMap;
  serverRequest: ServerReqEventMap;
  clientRespond: ClientResEventMap;
}>;

const createAppCentralBus = () => {
  return createCentralBus<ApiSchema>({
    clientPushPair: {
      ping: undefined,
      ping2: undefined,
    },
    serverPushPair: {
      text_history: undefined,
      text_history2: undefined,
    },
    clientRequestPair: {
      req_config: "res_config",
      req_text_history_by_session_id: "res_text_history_by_session_id",
      req_sessions: "res_sessions",
    },
    serverRequestPair: {
      req_user_agent: "res_user_agent",
    },
  });
};

export type ClientApi = ReturnType<typeof createClientApi>["api"];
export function createClientApi() {
  const { client } = createAppCentralBus();
  return {
    api: client.bus,
    wsBridge: client.wsBridge,
  };
}

export type ServerApi = ReturnType<typeof createServerApi>["api"];
export function createServerApi() {
  const { server } = createAppCentralBus();
  return {
    api: server.bus,
    wsBridge: server.wsBridge,
  };
}
