import { signal } from "alien-signals";
import { debounce } from "es-toolkit";
import type { MessageContext } from "roarr";
import { config } from "#/util/config";
import { hmr } from "#/util/hmr";
import { log } from "#/util/logger";
import { mainWindow } from "#/window/main";
import { vnOverlayWindow } from "#/window/vnOverlay";
import { IPC } from "./_util";
import { vnOverlayIPC } from "./vnOverlay";

function createSettingsIPC() {
  class SettingsIPC extends IPC()<"settings"> {
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
        vnOverlayIPC().send("vnOverlay:setSettings", {
          ...payload,
        });
        config.debouncedSet({ window: { vn_overlay: payload.settings } });
      });

      this.handle("settings:getConfig", async () => {
        return config.getAll();
      });
    }
  }

  return new SettingsIPC();
}

export const settingsIPC = signal(createSettingsIPC());

//  ───────────────────────────────── HMR ─────────────────────────────────

if (import.meta.hot) {
  hmr.register(import.meta.url);
  import.meta.hot.accept((mod) => {
    hmr.update(import.meta.url, mod);
    mod?.settingsIPC().register();
  });
  import.meta.hot.dispose(() => {
    settingsIPC().unregister();
  });
}
