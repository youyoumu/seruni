import type {
  WsFromClient,
  WsFromClientEvent,
  WsFromServer,
  WsFromServerEvent,
} from "@repo/preload/websocket";
import { isJSONValue } from "es-toolkit";
import { type DefaultEventsMap, Server, type Socket } from "socket.io";
import type { JsonValue, Writable } from "type-fest";
import { log } from "#/util/logger";

hmr.log(import.meta);

export type WsServerAck<Event extends WsFromServerEvent> = (
  data: WsFromServer[Event]["output"],
) => void;

export type WsServerCallback<Event extends WsFromClientEvent> = (
  data: WsFromClient[Event]["output"],
) => void;

type EventWithPrefix<
  All extends string,
  Prefix extends string,
> = All extends `${Prefix}:${string}` ? All : never;

function createAppWebsocketClass() {
  class AppWebsocket<Prefix extends string> {
    prefix: Prefix;
    #controller = new AbortController();
    static io = new Server();
    static socket: Socket<
      DefaultEventsMap,
      DefaultEventsMap,
      DefaultEventsMap,
      any
    >;

    constructor(options: {
      prefix: Prefix;
    }) {
      this.prefix = options.prefix;
    }

    on<Event extends EventWithPrefix<WsFromClientEvent, Prefix>>(
      event: Event,
      listener: (
        ...args: [
          ...WsFromClient[Event]["input"],
          callback?: WsServerCallback<Event>,
        ]
      ) => void,
    ) {
      const wrapped = (
        ...args: [
          ...WsFromClient[Event]["input"],
          callback: WsServerCallback<Event>,
        ]
      ) => {
        const data: Writable<JsonValue> = [];
        for (let i = 0; i < args.length; i++) {
          if (isJSONValue(args[i])) {
            data.push(args[i] as JsonValue);
          }
        }

        log.trace(
          {
            event,
            data,
          },
          "WS on",
        );

        listener(...args);
      };

      AppWebsocket.socket.on(event as string, wrapped);

      this.#controller.signal.addEventListener(
        "abort",
        () => AppWebsocket.socket.off(event as string, wrapped),
        { once: true },
      );
    }

    emit<Event extends WsFromServerEvent>(
      event: Event,
      ...args: [...WsFromServer[Event]["input"], ack?: WsServerAck<Event>]
    ) {
      const data: Writable<JsonValue> = [];
      for (let i = 0; i < args.length; i++) {
        if (isJSONValue(args[i])) {
          data.push(args[i] as unknown as JsonValue);
        }
      }
      log.trace(
        {
          event,
          data,
        },
        "WS emit",
      );

      AppWebsocket.socket.emit(event, ...args);
    }

    async register() {
      await AppWebsocket.prepare();
    }

    unregister() {
      this.#controller.abort();
    }

    static async prepare() {
      if (AppWebsocket.socket) return;
      const { promise, resolve } = Promise.withResolvers<void>();
      AppWebsocket.io.on("connection", (socket) => {
        AppWebsocket.socket = socket;
        resolve();
      });
      await promise;
    }
  }

  return AppWebsocket;
}

export const AppWebsocket = hmr.module(createAppWebsocketClass());
