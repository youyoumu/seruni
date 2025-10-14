import type { DefaultEventsMap } from "socket.io";
import {
  io,
  type ManagerOptions,
  type Socket,
  type SocketOptions,
} from "socket.io-client";
import z from "zod";
import { zDevWS } from "./dev";

export { zDevWS as devWS };

const zWsFromServer = z.object({
  ...zDevWS.server.shape,
});
const zWsFromServerEvent = zWsFromServer.keyof();
export type WsFromServer = z.infer<typeof zWsFromServer>;
export type WsFromServerEvent = z.infer<typeof zWsFromServerEvent>;

const zWsFromClient = z.object({
  ...zDevWS.client.shape,
});
const zWsFromClientEvent = zWsFromClient.keyof();
export type WsFromClient = z.infer<typeof zWsFromClient>;
export type WsFromClientEvent = z.infer<typeof zWsFromClientEvent>;

export type WsClientAck<Event extends WsFromClientEvent> = (
  data: WsFromClient[Event]["output"],
) => void;
export type WsClientCallback<Event extends WsFromServerEvent> = (
  data: WsFromServer[Event]["output"],
) => void;
export type WsClientListener<Event extends WsFromServerEvent> = (
  ...args: [...WsFromServer[Event]["input"], callback?: WsClientCallback<Event>]
) => void;
export type WsClient = {
  socket: Socket<DefaultEventsMap, DefaultEventsMap>;
  emit: <Event extends WsFromClientEvent>(
    event: Event,
    ...args: [...WsFromClient[Event]["input"], ack?: WsClientAck<Event>]
  ) => WsFromClient[Event]["output"];

  on: <Event extends WsFromServerEvent>(
    event: Event,
    listener: WsClientListener<Event>,
  ) => void;

  off: <Event extends WsFromServerEvent>(
    event: Event,
    listener: WsClientListener<Event>,
  ) => void;
};

type Fn = () => void;
const listenerMap = new WeakMap<Fn, Fn>();

export function createSocketClient(
  uri: string,
  opts?: Partial<ManagerOptions & SocketOptions>,
) {
  const socket = io(uri, opts);
  const socketClient: WsClient = {
    socket,
    emit: (event, ...args) => {
      const callback =
        typeof args[args.length - 1] === "function"
          ? (args.pop() as WsClientAck<typeof event>)
          : undefined;
      //check if channel valid
      const eventResult = zWsFromClientEvent.safeParse(event);
      if (eventResult.error) {
        console.error("Invalid event", eventResult);
        return;
      }

      //check if args valid
      const argsResult = zWsFromClient.shape[event].shape.input.safeParse(args);
      if (argsResult.error) {
        console.error("Invalid args", argsResult);
        return;
      }

      if (callback) args.push(callback);

      socket.emit(event, ...args);
    },

    on: (event, listener) => {
      const wrappedListener = (...args: Parameters<typeof listener>) =>
        listener(...args);
      listenerMap.set(listener as Fn, wrappedListener as Fn);
      socket.on(event as string, wrappedListener);
    },

    off: (event, listener) => {
      const wrappedListener = listenerMap.get(listener as Fn);
      if (wrappedListener) {
        socket.off(event as string, wrappedListener);
        listenerMap.delete(listener as Fn);
      }
    },
  };
  return socketClient;
}
