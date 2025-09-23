import { session } from "electron";
import { yomitanExtension } from "#/extension/yomitan";
import { log } from "#/util/logger";
import { AppWindow } from "./_util";

class YomitanWindow extends AppWindow {
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
    const ext = await session.defaultSession.extensions.loadExtension(
      yomitanExtension.getExtensionPath(),
    );
    const optionsPage = `chrome-extension://${ext.id}/settings.html`;
    log.info(`Opening Yomitan settings page: ${optionsPage}`);
    await this.win?.loadURL(optionsPage);
    return true;
  }
}

export const yomitanWindow = new YomitanWindow();
