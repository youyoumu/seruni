import { type AppEventMap } from "@repo/shared/types";
import { TypedEventTarget } from "typescript-event-target";

export function createBus() {
  return new TypedEventTarget<AppEventMap>();
}

export type Bus = TypedEventTarget<AppEventMap>;
