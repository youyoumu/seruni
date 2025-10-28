import { app } from "electron";
import { delay } from "es-toolkit";
import { env } from "#/env";
import { log } from "#/util/logger";
import { AppWindow } from "./windowBase";
import { yomitanWindow } from "./windowYomitan";

class MainWindow extends AppWindow() {
  constructor() {
    super({
      width: 1280,
      height: 1000,
      show: false,
    });
  }

  override register() {
    super.register();
    this.handle("mainWindow:reload", () => {
      log.debug("Reloading main window");
      yomitanWindow()
        .loadYomitan()
        .then(() => {
          this.win?.webContents.reloadIgnoringCache();
        });
    });
  }

  override async create() {
    super.create();

    await this.waitForRenderer(env.RENDERER_URL);
    await this.win?.loadURL(env.RENDERER_URL);
    return true;
  }

  async waitForRenderer(url: string, retries = 30, delayDuration = 500) {
    for (let i = 0; i < retries; i++) {
      try {
        await this.ping(url);
        return;
      } catch {
        await delay(delayDuration);
      }
    }
    throw new Error(`Renderer at ${url} not responding after ${retries} tries`);
  }

  async ping(url: string): Promise<void> {
    log.trace({ namespace: "WIN" }, `Pinging ${url}`);
    const res = await fetch(url, { method: "GET" });
    if (res.ok) {
      return;
    }
    throw new Error(`Bad status: ${res.status} ${res.statusText}`);
  }
}

export const mainWindow = hmr.module(new MainWindow());

//  ───────────────────────────────── HMR ─────────────────────────────────

if (import.meta.hot) {
  const { mainWindow } = await hmr.register<typeof import("./windowMain")>(
    import.meta,
  );
  import.meta.hot.accept((mod) => {
    hmr.update(import.meta, mod);
    mainWindow().register();
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
