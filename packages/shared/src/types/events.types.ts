import { type TextHistory } from "#/db/schema";

export type Config = {
  workdir: string;
};

export interface Envelope<T = undefined> {
  data: T;
  requestId: string;
}

export interface ServerEventMap {
  text_history: CustomEvent<Envelope<TextHistory>>;
  res_config: CustomEvent<Envelope<Config>>;
}

export interface ClientEventMap {
  req_config: CustomEvent<Envelope>;
}

export const EVENT_MAP: Record<keyof ClientEventMap, keyof ServerEventMap> = {
  req_config: "res_config",
};
