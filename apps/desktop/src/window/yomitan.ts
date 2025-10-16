import { session } from "electron";
import { env } from "#/env";
import { yomitanExtension } from "#/extension/yomitan";
import { log } from "#/util/logger";
import { AppWindow } from "./base";

hmr.log(import.meta);

class YomitanWindow extends AppWindow() {
  preloadScriptIds: string[] = [];
  ext: Electron.Extension | undefined;

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

    if (this.ext) {
      session.defaultSession.extensions.removeExtension(this.ext.id);
      this.ext = undefined;
      this.loadYomitan();
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

    const ext = await session.defaultSession.extensions.loadExtension(
      yomitanExtension.getExtensionPath(),
    );
    this.ext = ext;
    return ext;
  }
}

export const yomitanWindow = hmr.module(new YomitanWindow());

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
