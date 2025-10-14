import type {
  IPCFromMain,
  IPCFromMainChannel,
  IPCFromRenderer,
  IPCFromRendererChannel,
} from "@repo/preload/ipc";
import { ipcMain } from "electron";
import { Roarr as log } from "roarr";
import { bus } from "#/util/bus";

hmr.log(import.meta.url);

type ChannelsWithPrefix<
  All extends string,
  Prefix extends string,
> = All extends `${Prefix}:${string}` ? All : never;

function createIPCClass() {
  class IPC<Prefix extends string> {
    prefix: Prefix;
    #controller = new AbortController();
    static #instances: Set<IPC<string>> = new Set();

    constructor(options: {
      prefix: Prefix;
    }) {
      this.prefix = options.prefix;
      IPC.#instances.add(this);
    }

    on<K extends ChannelsWithPrefix<IPCFromRendererChannel, Prefix>>(
      channel: K,
      listener: (
        event: Electron.IpcMainEvent,
        ...args: IPCFromRenderer[K]["input"]
      ) => IPCFromRenderer[K]["output"],
    ) {
      const uuid = crypto.randomUUID();
      ipcMain.on(channel, listener);
      this.#controller.signal.addEventListener(
        "abort",
        () => {
          log.trace(
            { namespace: `IPC:${this.prefix}` },
            `Removing listener ${channel} ${uuid}`,
          );
          ipcMain.removeListener(channel, listener);
        },
        { once: true },
      );
    }

    handle<K extends ChannelsWithPrefix<IPCFromRendererChannel, Prefix>>(
      channel: K,
      listener: (
        event: Electron.IpcMainInvokeEvent,
        ...args: IPCFromRenderer[K]["input"]
      ) => Promise<IPCFromRenderer[K]["output"]>,
    ) {
      const uuid = crypto.randomUUID();
      ipcMain.handle(channel, listener);
      this.#controller.signal.addEventListener(
        "abort",
        () => {
          log.trace(
            { namespace: `IPC:${this.prefix}` },
            `Removing handler ${channel} ${uuid}`,
          );
          ipcMain.removeHandler(channel);
        },
        { once: true },
      );
    }

    send<K extends IPCFromMainChannel>(
      channel: K,
      ...payload: IPCFromMain[K]["input"]
    ) {
      bus.emit("webContent:send", {
        channel,
        payload,
      });
    }

    register() {}

    unregister() {
      this.#controller.abort();
    }

    static unregisterAll() {
      for (const instance of IPC.#instances) {
        instance.unregister();
      }
      IPC.#instances.clear();
    }

    static registerAll() {
      for (const instance of IPC.#instances) {
        instance.register();
      }
    }
  }

  return IPC;
}

export const IPC = hmr.module(createIPCClass());

//  ───────────────────────────────── HMR ─────────────────────────────────

if (import.meta.hot) {
  hmr.register(import.meta);
  import.meta.hot.accept((mod) => {
    hmr.update(import.meta, mod);
    import.meta.hot?.invalidate();
  });
}
