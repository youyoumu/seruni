import { type TextHistory } from "#/db/schema";

type Config = {
  workdir: string;
};

export interface Envelope<T> {
  data: T;
  requestId?: string; // Optional: only present for req/res pairs
}

export interface AppEventMap {
  text_history: CustomEvent<TextHistory>;
  req_config: CustomEvent<Envelope<undefined>>;
  res_config: CustomEvent<Envelope<Config>>;
}
