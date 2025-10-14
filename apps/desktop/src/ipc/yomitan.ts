import { yomitanExtension } from "#/extension/yomitan";
import { log } from "#/util/logger";
import { yomitanWindow } from "../window/yomitan";
import { IPC } from "./base";

hmr.log(import.meta.url);

function createYomitanIPC() {
  class YomitanIPC extends IPC()<"yomitan"> {
    constructor() {
      super({
        prefix: "yomitan",
      });
    }

    override register() {
      this.on("yomitan:open", () => {
        log.info("Opening Yomitan");
        yomitanWindow().open();
      });

      this.on("yomitan:minimize", () => {
        yomitanWindow().win?.minimize();
      });

      this.on("yomitan:reinstall", async () => {
        yomitanWindow().win?.close();
        await yomitanExtension.reinstall();
        yomitanWindow().open();
      });
    }
  }

  return new YomitanIPC();
}

export const yomitanIPC = hmr.module(createYomitanIPC());

//  ───────────────────────────────── HMR ─────────────────────────────────

if (import.meta.hot) {
  hmr.register(import.meta);
  import.meta.hot.accept((mod) => {
    hmr.update(import.meta, mod);
    mod?.yomitanIPC().register();
  });
  import.meta.hot.dispose(() => {
    yomitanIPC().unregister();
  });
}
