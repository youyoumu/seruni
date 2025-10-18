import { yomitanExtension } from "#/extension/yomitan";
import { log } from "#/util/logger";
import { yomitanWindow } from "../window/yomitan";
import { IPC } from "./base";

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

    this.handle("yomitan:reinstall", async () => {
      try {
        yomitanWindow().win?.close();
        await yomitanExtension.reinstall();
        return true;
      } catch {
        return false;
      }
    });
  }
}

export const yomitanIPC = hmr.module(new YomitanIPC());

//  ───────────────────────────────── HMR ─────────────────────────────────

if (import.meta.hot) {
  const { yomitanIPC } = await hmr.register<typeof import("./yomitan")>(
    import.meta,
  );
  import.meta.hot.accept((mod) => {
    hmr.update(import.meta, mod);
    yomitanIPC().register();
  });
  import.meta.hot.dispose(() => {
    yomitanIPC().unregister();
  });
}
