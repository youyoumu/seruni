import { session } from "electron";
import { env } from "#/env";
import { yomitanExtension } from "#/extension/yomitan";
import { log } from "#/util/logger";
import { AppWindow } from "./base";

hmr.log(import.meta);

function createYomitanWindow() {
  class YomitanWindow extends AppWindow() {
    preloadScriptIds: string[] = [];

    constructor() {
      super({
        width: 1200,
        height: 800,
        show: false,
        webPreferences: {
          preload: undefined,
        },
      });
    }

    override async create() {
      super.create();
      if (!yomitanExtension.isInstalled()) {
        await yomitanExtension.install();
      }
      if (yomitanExtension.installingLock) {
        log.warn("Yomitan extension is installing, waiting for it to finish");
        return false;
      }

      const ext = await this.loadYomitan();
      if (!ext) return false;
      const optionsPage = `chrome-extension://${ext.id}/settings.html`;
      log.info(`Opening Yomitan settings page: ${optionsPage}`);
      await this.win?.loadURL(optionsPage);
      return true;
    }

    async loadYomitan() {
      if (!yomitanExtension.isInstalled()) {
        return;
      }

      this.preloadScriptIds.push(
        session.defaultSession.registerPreloadScript({
          type: "service-worker",
          filePath: env.CHROME_PRELOAD_PATH,
        }),
      );

      this.preloadScriptIds.push(
        session.defaultSession.registerPreloadScript({
          type: "frame",
          filePath: env.CHROME_PRELOAD_PATH,
        }),
      );

      return await session.defaultSession.extensions.loadExtension(
        yomitanExtension.getExtensionPath(),
      );
    }
  }

  return new YomitanWindow();
}

export const yomitanWindow = hmr.module(createYomitanWindow());

//  ───────────────────────────────── HMR ─────────────────────────────────

if (import.meta.hot) {
  const { yomitanWindow } = await hmr.register<typeof import("./yomitan")>(
    import.meta,
  );
  import.meta.hot.accept((mod) => {
    hmr.update(import.meta, mod);
    yomitanWindow().open();
  });
  import.meta.hot.dispose(() => {
    yomitanWindow().unregister();
    yomitanWindow().win?.close();
    yomitanWindow().preloadScriptIds.forEach((id) => {
      session.defaultSession.unregisterPreloadScript(id);
    });
  });
}
