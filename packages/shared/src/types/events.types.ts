import { type TextHistory } from "#/db/schema";

export interface AppEventMap {
  text_history: CustomEvent<TextHistory>;
}
