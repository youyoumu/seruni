import { type TextHistory } from "#/db/schema";

export type Config = {
  workdir: string;
};

//          ╭─────────────────────────────────────────────────────────╮
//          │                          PUSH                           │
//          ╰─────────────────────────────────────────────────────────╯
export interface ClientPushEventMap {
  ping: CustomEvent;
}
export const CLIENT_PUSH_MAP: Record<keyof ClientPushEventMap, keyof ClientPushEventMap> = {
  ping: "ping",
};

export interface ServerPushEventMap {
  text_history: CustomEvent<TextHistory>;
}
export const SERVER_PUSH_MAP: Record<keyof ServerPushEventMap, keyof ServerPushEventMap> = {
  text_history: "text_history",
};

//   ──────────────────────────────────────────────────────────────────────

export interface WithReqId<T = undefined> {
  data: T;
  requestId: string;
}

//          ╭─────────────────────────────────────────────────────────╮
//          │                     CLIENT REQUEST                      │
//          ╰─────────────────────────────────────────────────────────╯

export interface ClientReqEventMap {
  req_config: CustomEvent<WithReqId>;
  req_config2: CustomEvent<WithReqId>;
}
export interface ServerResEventMap {
  res_config: CustomEvent<WithReqId<Config>>;
  res_config2: CustomEvent<WithReqId<Config>>;
}
export const CLIENT_REQ_MAP: Record<keyof ClientReqEventMap, keyof ServerResEventMap> = {
  req_config: "res_config",
  req_config2: "res_config2",
};

//          ╭─────────────────────────────────────────────────────────╮
//          │                     SERVER REQUEST                      │
//          ╰─────────────────────────────────────────────────────────╯
export interface ServerReqEventMap {
  req_user_agent: CustomEvent<WithReqId>;
}
export interface ClientResEventMap {
  res_user_agent: CustomEvent<WithReqId<string>>;
}
export const SERVER_REQ_MAP: Record<keyof ServerReqEventMap, keyof ClientResEventMap> = {
  req_user_agent: "res_user_agent",
};
