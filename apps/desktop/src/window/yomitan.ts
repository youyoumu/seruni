import { signal } from "alien-signals";
import { session } from "electron";
import { env } from "#/env";
import { yomitanExtension } from "#/extension/yomitan";
import { hmr } from "#/util/hmr";
import { log } from "#/util/logger";
import { AppWindow } from "./_util";

function createYomitanWindow() {
  class YomitanWindow extends AppWindow() {
    preloadScriptIds: string[] = [];

    constructor() {
      super({
        width: 1200,
        height: 800,
        show: false,
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
      //TODO: clear service workers cache with force
      await session.defaultSession.clearStorageData({
        storages: ["serviceworkers"],
      });

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

      const ext = await session.defaultSession.extensions.loadExtension(
        yomitanExtension.getExtensionPath(),
      );
      const optionsPage = `chrome-extension://${ext.id}/settings.html`;
      log.info(`Opening Yomitan settings page: ${optionsPage}`);
      await this.win?.loadURL(optionsPage);
      return true;
    }
  }

  return new YomitanWindow();
}

export const yomitanWindow = signal(createYomitanWindow());

if (import.meta.hot) {
  hmr.register(import.meta.url);
  import.meta.hot.accept((mod) => {
    hmr.update(import.meta.url, mod);
    mod?.yomitanWindow().open();
  });
  import.meta.hot.dispose(() => {
    yomitanWindow().win?.close();
    yomitanWindow().preloadScriptIds.forEach((id) => {
      session.defaultSession.unregisterPreloadScript(id);
    });
  });
}
