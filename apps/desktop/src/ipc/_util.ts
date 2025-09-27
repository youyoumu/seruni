import type {
  IPCFromMain,
  IPCFromMainChannel,
  IPCFromRenderer,
  IPCFromRendererChannel,
} from "@repo/preload/ipc";
import { signal } from "alien-signals";
import { type BrowserWindow, ipcMain } from "electron";
import { hmr } from "#/util/hmr";

type ChannelsWithPrefix<
  All extends string,
  Prefix extends string,
> = All extends `${Prefix}:${string}` ? All : never;

class IPC<Prefix extends string> {
  prefix: Prefix;
  #win: () => (BrowserWindow | undefined)[] | undefined;
  #controller = new AbortController();
  static #instances: Set<IPC<string>> = new Set();

  constructor(options: {
    prefix: Prefix;
    win: () => (BrowserWindow | undefined)[] | undefined;
  }) {
    this.prefix = options.prefix;
    this.#win = options.win;
    IPC.#instances.add(this);
  }

  on<K extends ChannelsWithPrefix<IPCFromRendererChannel, Prefix>>(
    channel: K,
    listener: (
      event: Electron.IpcMainEvent,
      ...args: IPCFromRenderer[K]["input"]
    ) => IPCFromRenderer[K]["output"],
  ) {
    ipcMain.on(channel, listener);
    this.#controller.signal.addEventListener(
      "abort",
      () => ipcMain.removeListener(channel, listener),
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
    ipcMain.handle(channel, listener);
    this.#controller.signal.addEventListener(
      "abort",
      () => ipcMain.removeHandler(channel),
      { once: true },
    );
  }

  send<K extends IPCFromMainChannel>(
    channel: K,
    payload: IPCFromMain[K]["output"],
  ) {
    this.#win()?.forEach((win) => {
      win?.webContents.send(channel, payload);
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

const IPC_ = signal(IPC);
export { IPC_ as IPC };

//  ───────────────────────────────── HMR ─────────────────────────────────

if (import.meta.hot) {
  hmr.register(import.meta.url);
  import.meta.hot.accept((mod) => {
    hmr.update(import.meta.url, mod);
    import.meta.hot?.invalidate();
  });
}
