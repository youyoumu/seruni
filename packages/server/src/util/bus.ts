import { type ServerEventMap, type ClientEventMap } from "@repo/shared/types";
import { TypedEventTarget } from "typescript-event-target";

export function createServerBus() {
  return new TypedEventTarget<ServerEventMap>();
}

export function createClientBus() {
  return new TypedEventTarget<ClientEventMap>();
}

export type ServerBus = TypedEventTarget<ServerEventMap>;
export type ClientBus = TypedEventTarget<ClientEventMap>;
