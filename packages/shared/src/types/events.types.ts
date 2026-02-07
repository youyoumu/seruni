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
export interface ServerPushEventMap {
  text_history: CustomEvent<TextHistory>;
}

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
}
export interface ServerResEventMap {
  res_config: CustomEvent<WithReqId<Config>>;
}
export const CLIENT_REQ_MAP: Record<keyof ClientReqEventMap, keyof ServerResEventMap> = {
  req_config: "res_config",
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
