import { log } from "#/util/logger";
import { yomitanWindow } from "../window/yomitan";
import { IPC } from "./_util";

class YomitanIPC extends IPC<"yomitan"> {
  constructor() {
    super({
      prefix: "yomitan",
      win: () => yomitanWindow.win,
    });
  }

  override register() {
    this.on("yomitan:open", () => {
      log.info("Opening Yomitan");
      yomitanWindow.open();
    });

    this.on("yomitan:minimize", () => {
      yomitanWindow.win?.minimize();
    });
  }
}

export const yomitanIPC = new YomitanIPC();
