import { createApiClient } from "#/events";
import { type TextHistory } from "#/db/schema";
import type { WithReqId } from "#/events";

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

export type ClientApi = ReturnType<typeof createClientApi>["clientApi"];
export function createClientApi() {
  const { clientApi, onPayload, setupWSForwarder } = createApiClient<
    ClientPushEventMap,
    ServerPushEventMap,
    ClientReqEventMap,
    ServerResEventMap,
    ServerReqEventMap,
    ClientResEventMap
  >(
    "client",
    {
      ping: undefined,
    },
    {
      text_history: undefined,
    },
    {
      req_config: "res_config",
      req_config2: "res_config2",
    },
    {
      req_user_agent: "res_user_agent",
    },
  );

  return {
    clientApi,
    onPayload,
    setupWSForwarder,
  };
}

export type ServerApi = ReturnType<typeof createServerApi>["serverApi"];
export function createServerApi() {
  const { serverApi, onPayload, setupWSForwarder } = createApiClient<
    ClientPushEventMap,
    ServerPushEventMap,
    ClientReqEventMap,
    ServerResEventMap,
    ServerReqEventMap,
    ClientResEventMap
  >(
    "server",
    {
      ping: undefined,
    },
    {
      text_history: undefined,
    },
    {
      req_config: "res_config",
      req_config2: "res_config2",
    },
    {
      req_user_agent: "res_user_agent",
    },
  );

  return {
    serverApi,
    onPayload,
    setupWSForwarder,
  };
}
