import type {
  WsFromClient,
  WsFromClientEvent,
  WsFromServer,
  WsFromServerEvent,
} from "@repo/preload/websocket";
import { signal } from "alien-signals";
import { type DefaultEventsMap, Server, type Socket } from "socket.io";
import { hmr } from "#/util/hmr";

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
    static #instances: Set<AppWebsocket<string>> = new Set();
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
      AppWebsocket.#instances.add(this);
    }

    on<Event extends EventWithPrefix<WsFromClientEvent, Prefix>>(
      event: Event,
      listener: (
        ...args: [
          ...WsFromClient[Event]["input"],
          callback: WsServerCallback<Event>,
        ]
      ) => void,
    ) {
      AppWebsocket.socket.on(event as string, listener);
      this.#controller.signal.addEventListener(
        "abort",
        () => AppWebsocket.socket.off(event as string, listener),
        { once: true },
      );
    }

    emit<Event extends WsFromServerEvent>(
      event: Event,
      ...args: [...WsFromServer[Event]["input"], ack: WsServerAck<Event>]
    ) {
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

    static unregisterAll() {
      for (const instance of AppWebsocket.#instances) {
        instance.unregister();
      }
      AppWebsocket.#instances.clear();
    }

    static registerAll() {
      for (const instance of AppWebsocket.#instances) {
        instance.register();
      }
    }
  }

  return AppWebsocket;
}

export const AppWebsocket = signal(createAppWebsocketClass());

//  ───────────────────────────────── HMR ─────────────────────────────────

if (import.meta.hot) {
  hmr.register(import.meta.url);
  import.meta.hot.accept((mod) => {
    hmr.update(import.meta.url, mod);
    import.meta.hot?.invalidate();
  });
}
