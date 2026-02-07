import {
  type ServerReqEventMap,
  type ClientResEventMap,
  type ServerPushEventMap,
  type ClientReqEventMap,
  type ServerResEventMap,
} from "@repo/shared/types";
import { TypedEventTarget } from "typescript-event-target";

export function createServerPushBus() {
  return new TypedEventTarget<ServerPushEventMap>();
}

export function createServerReqBus() {
  return new TypedEventTarget<ServerReqEventMap>();
}

export function createServerResBus() {
  return new TypedEventTarget<ServerResEventMap>();
}

export function createClientReqBus() {
  return new TypedEventTarget<ClientReqEventMap>();
}

export type ServerPushBus = TypedEventTarget<ServerPushEventMap>;
export type ServerReqBus = TypedEventTarget<ServerReqEventMap>;
export type ServerResBus = TypedEventTarget<ServerPushEventMap>;
export type ClientResBus = TypedEventTarget<ClientResEventMap>;
