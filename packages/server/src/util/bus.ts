import {
  type ServerReqEventMap,
  type ClientResEventMap,
  type ServerResEventMap,
  type ClientReqEventMap,
} from "@repo/shared/types";
import { TypedEventTarget } from "typescript-event-target";

export function createServerReqBus() {
  return new TypedEventTarget<ServerReqEventMap>();
}

export function createServerResBus() {
  return new TypedEventTarget<ServerResEventMap>();
}

export function createClientReqBus() {
  return new TypedEventTarget<ClientReqEventMap>();
}

export type ServerReqBus = TypedEventTarget<ServerReqEventMap>;
export type ServerResBus = TypedEventTarget<ServerResEventMap>;
export type ClientResBus = TypedEventTarget<ClientResEventMap>;
