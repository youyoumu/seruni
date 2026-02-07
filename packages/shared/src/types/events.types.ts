import { type TextHistory } from "#/db/schema";

export type Config = {
  workdir: string;
};

export interface Envelope<T = undefined> {
  data: T;
  requestId: string;
}

export interface ClientPushEventMap {
  ping: CustomEvent<Envelope>;
}
export interface ServerPushEventMap {
  text_history: CustomEvent<Envelope<TextHistory>>;
}

//   ──────────────────────────────────────────────────────────────────────

export interface ClientReqEventMap {
  req_config: CustomEvent<Envelope>;
}
export interface ServerResEventMap {
  res_config: CustomEvent<Envelope<Config>>;
}

//   ──────────────────────────────────────────────────────────────────────
export interface ServerReqEventMap {
  req_user_agent: CustomEvent<Envelope>;
}
export interface ClientResEventMap {
  res_user_agent: CustomEvent<Envelope<string>>;
}

export const EVENT_MAP: Record<keyof ClientReqEventMap, keyof ServerResEventMap> = {
  req_config: "res_config",
};
