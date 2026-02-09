import { createCentralBus } from "#/events";
import { type TextHistory } from "#/db/schema";
import type { WithReqId, CreateSchema } from "#/events";

export type Config = {
  workdir: string;
};

export type ClientPushEventMap = {
  ping: CustomEvent;
};
export type ServerPushEventMap = {
  text_history: CustomEvent<TextHistory>;
};

export type ClientReqEventMap = {
  req_config: CustomEvent<WithReqId>;
  req_config2: CustomEvent<WithReqId>;
};
export type ServerResEventMap = {
  res_config: CustomEvent<WithReqId<Config>>;
  res_config2: CustomEvent<WithReqId<Config>>;
};

export type ServerReqEventMap = {
  req_user_agent: CustomEvent<WithReqId>;
};
export type ClientResEventMap = {
  res_user_agent: CustomEvent<WithReqId<string>>;
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
    },
    serverPushPair: {
      text_history: undefined,
    },
    clientRequestPair: {
      req_config: "res_config",
      req_config2: "res_config2",
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
    onPayload: client.onPayload,
    setupWSForwarder: client.setupWSForwarder,
  };
}

export type ServerApi = ReturnType<typeof createServerApi>["api"];
export function createServerApi() {
  const { server } = createAppCentralBus();
  return {
    api: server.bus,
    onPayload: server.onPayload,
    setupWSForwarder: server.setupWSForwarder,
  };
}
