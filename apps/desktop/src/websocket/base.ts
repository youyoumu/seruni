import fs from "node:fs";
import { readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  WsFromClient,
  WsFromClientEvent,
  WsFromServer,
  WsFromServerEvent,
} from "@repo/preload/websocket";
import { signal } from "alien-signals";
import { isJSONValue } from "es-toolkit";
import getPort from "get-port";
import { type DefaultEventsMap, Server, type Socket } from "socket.io";
import type { JsonValue, Writable } from "type-fest";
import { env } from "#/env";
import { hmr } from "#/util/hmr";
import { log } from "#/util/logger";

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

    static unregisterAll() {
      for (const instance of AppWebsocket.#instances) {
        instance.unregister();
      }
      AppWebsocket.#instances.clear();
    }

    static async registerAll() {
      const port = await AppWebsocket.assignPort();
      AppWebsocket.io.listen(port);
      log.info(`Websocket server listening on port ${port}`);
      for (const instance of AppWebsocket.#instances) {
        instance.register();
      }
    }

    static async assignPort() {
      const port = await getPort();
      fs.mkdirSync(env.TEMP_PATH, { recursive: true });

      //TODO: move to util
      async function atomicWriteFile(filePath: string, content: string) {
        const tmp = join(env.TEMP_PATH, `.tmp-${Date.now()}-${Math.random()}`);
        await writeFile(tmp, content, "utf8");
        await rename(tmp, filePath); // atomic replace
      }
      await atomicWriteFile(env.PORT_FILE_PATH, port.toString());
      return port;
    }

    static async readAssignedPort() {
      const data = await readFile(env.PORT_FILE_PATH, "utf8");
      return Number(data.trim());
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
