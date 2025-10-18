import { BrowserWindow } from "electron";
import { env } from "#/env";
import { type BusEventName, type BusEvents, bus } from "#/util/bus";
import { log } from "#/util/logger";

type BrowserWindowOptions = ConstructorParameters<typeof BrowserWindow>[0];
const appWindow = class AppWindow {
  options: BrowserWindowOptions;
  win: BrowserWindow | undefined;
  #controller = new AbortController();

  constructor(options: BrowserWindowOptions = {}) {
    const defaultOptions: BrowserWindowOptions = {
      webPreferences: {
        preload: env.IPC_PRELOAD_PATH,
      },
    };

    this.options = {
      ...defaultOptions,
      ...options,
      webPreferences: {
        ...defaultOptions.webPreferences,
        ...options.webPreferences,
      },
    };

    this.register();
  }

  register() {
    const listener = ({ channel, payload }: BusEvents["webContent:send"]) => {
      this.win?.webContents.send(channel, ...payload);
    };

    const uuid = crypto.randomUUID();
    log.trace({ namespace: `WIN` }, `Adding listener webContent:send ${uuid}`);
    bus.on("webContent:send", listener);

    this.#controller.signal.addEventListener(
      "abort",
      () => {
        log.trace(
          { namespace: `WIN` },
          `Removing listener webContent:send ${uuid}`,
        );
        bus.removeListener("webContent:send", listener);
      },
      { once: true },
    );
  }

  handle<K extends BusEventName>(
    eventName: K,
    listener: (payload: BusEvents[K]) => void,
  ) {
    const uuid = crypto.randomUUID();
    bus.on(eventName, listener);
    this.#controller.signal.addEventListener(
      "abort",
      () => {
        log.trace(
          { namespace: `WIN` },
          `Removing handler ${eventName} ${uuid}`,
        );
        bus.removeListener(eventName, listener);
      },
      { once: true },
    );
  }

  unregister() {
    this.#controller.abort();
  }

  async create() {
    this.win = new BrowserWindow(this.options);

    this.win.on("closed", () => {
      this.win = undefined;
    });
    return true;
  }

  async open() {
    let ready = true;
    if (!this.win || this.win.isDestroyed()) {
      ready = await this.create();
    }
    if (ready) {
      this.win?.show();
    }
  }
};

export const AppWindow = hmr.module(appWindow);

//  ───────────────────────────────── HMR ─────────────────────────────────

if (import.meta.hot) {
  hmr.register(import.meta);
  import.meta.hot.accept((mod) => {
    hmr.update(import.meta, mod);
    import.meta.hot?.invalidate();
  });
}
