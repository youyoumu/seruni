import { session } from "electron";
import { yomitanExtension } from "#/extension/yomitan";
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
    await session.defaultSession.clearStorageData({
      storages: ["serviceworkers"],
    });
    const ext = await session.defaultSession.loadExtension(
      yomitanExtension.getExtensionPath(),
    );
    const optionsPage = `chrome-extension://${ext.id}/settings.html`;
    await this.win?.loadURL(optionsPage);
    this.win?.show();
  }
}

export const yomitanWindow = new YomitanWindow();
