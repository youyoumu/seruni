import { type TextHistory } from "#/db/schema";
import type { WithReqId } from "#/events";

export type Config = {
  workdir: string;
};

export interface ClientPushEventMap {
  ping: CustomEvent;
}
export interface ServerPushEventMap {
  text_history: CustomEvent<TextHistory>;
}

export interface ClientReqEventMap {
  req_config: CustomEvent<WithReqId>;
  req_config2: CustomEvent<WithReqId>;
}
export interface ServerResEventMap {
  res_config: CustomEvent<WithReqId<Config>>;
  res_config2: CustomEvent<WithReqId<Config>>;
}

export interface ServerReqEventMap {
  req_user_agent: CustomEvent<WithReqId>;
}
export interface ClientResEventMap {
  res_user_agent: CustomEvent<WithReqId<string>>;
}
