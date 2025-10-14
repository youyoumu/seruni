import { app } from "electron";
import { delay } from "es-toolkit";
import { env } from "#/env";
// import { log } from "#/util/logger";
import { AppWindow } from "./base";

hmr.log(import.meta.url);

function createMainWindow() {
  class MainWindow extends AppWindow() {
    constructor() {
      super({
        width: 1280,
        height: 1000,
        show: false,
      });
    }

    override async create() {
      super.create();

      await this.waitForRenderer(env.RENDERER_URL);
      await this.win?.loadURL(env.RENDERER_URL);
      return true;
    }

    async waitForRenderer(url: string, retries = 30, delayMs = 500) {
      for (let i = 0; i < retries; i++) {
        try {
          await this.ping(url);
          return;
        } catch {
          await delay(delayMs);
        }
      }
      throw new Error(
        `Renderer at ${url} not responding after ${retries} tries`,
      );
    }

    async ping(url: string): Promise<void> {
      //TODO: fix circular
      // log.trace({ url }, "pinging");
      const res = await fetch(url, { method: "GET" });
      if (res.ok) {
        return;
      }
      throw new Error(`Bad status: ${res.status} ${res.statusText}`);
    }
  }

  return new MainWindow();
}

export const mainWindow = hmr.module(createMainWindow());

//  ───────────────────────────────── HMR ─────────────────────────────────

if (import.meta.hot) {
  const { mainWindow } = await hmr.register<typeof import("./main")>(
    import.meta,
  );
  import.meta.hot.accept((mod) => {
    hmr.update(import.meta, mod);
    mainWindow().open();
  });
  import.meta.hot.dispose(() => {
    mainWindow().unregister();
    const listener = () => {};
    app.on("window-all-closed", listener);
    mainWindow().win?.close();
    setTimeout(() => {
      app.removeListener("window-all-closed", listener);
    }, 2000);
  });
}
