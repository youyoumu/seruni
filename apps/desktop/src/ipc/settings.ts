import { debounce } from "es-toolkit";
import type { MessageContext } from "roarr";
import { config } from "#/util/config";
import { log } from "#/util/logger";
import { mainWindow } from "#/window/main";
import { vnOverlayWindow } from "#/window/vnOverlay";
import { IPC } from "./_util";
import { vnOverlayIPC } from "./vnOverlay";

class SettingsIPC extends IPC<"settings"> {
  dLogTrace;
  constructor() {
    super({
      prefix: "settings",
      win: () => [mainWindow.win, vnOverlayWindow.win],
    });

    this.dLogTrace = debounce((context: MessageContext, message: string) => {
      log.trace(context, message);
    }, 1000);
  }

  override register() {
    this.on("settings:setVnOverlaySettings", (_, payload) => {
      this.dLogTrace(payload, "settings:setVnOverlaySettings");
      vnOverlayIPC.send("vnOverlay:setSettings", {
        ...payload,
      });
      config.debouncedSet({ window: { vn_overlay: payload.settings } });
    });

    this.handle("settings:getConfig", async () => {
      return config.getAll();
    });
  }
}

let ipc = new SettingsIPC();
export { ipc as settingsIPC };

//  ───────────────────────────────── HMR ─────────────────────────────────

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    ipc.unregister();
  });
  import.meta.hot.accept((mod) => {
    ipc = mod?.settingsIPC;
    ipc.register();
  });
}
