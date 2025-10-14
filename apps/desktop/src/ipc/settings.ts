import { debounce } from "es-toolkit";
import type { MessageContext } from "roarr";
import { env } from "#/env";
import { config } from "#/util/config";
import { log } from "#/util/logger";
import { python } from "#/util/python";
import { IPC } from "./base";
import { vnOverlayIPC } from "./vnOverlay";

hmr.log(import.meta);

function createSettingsIPC() {
  class SettingsIPC extends IPC()<"settings"> {
    dLogTrace;
    constructor() {
      super({
        prefix: "settings",
      });

      this.dLogTrace = debounce((context: MessageContext, message: string) => {
        log.trace(context, message);
      }, 1000);
    }

    override register() {
      this.on("settings:setSettings", (_, payload) => {
        this.dLogTrace(payload, "settings:setSettings");
        config.debouncedSet(payload);
      });

      this.on("settings:setVnOverlaySettings", (_, payload) => {
        this.dLogTrace(payload, "settings:setVnOverlaySettings");
        vnOverlayIPC().send("vnOverlay:setSettings", {
          ...payload,
        });
        config.debouncedSet({ window: { vn_overlay: payload } });
      });

      this.handle("settings:getConfig", async () => {
        return config.store;
      });

      this.handle("settings:getEnv", async () => {
        return env;
      });

      this.on("settings:installPython", async (_) => {
        const outputPath = await python.download();
        await python.extract({ tarPath: outputPath });
        await python.installDeps();
      });

      this.on("settings:runPython", async (_, payload) => {
        await python.run(payload);
      });
    }
  }

  return new SettingsIPC();
}

export const settingsIPC = hmr.module(createSettingsIPC());

//  ───────────────────────────────── HMR ─────────────────────────────────

if (import.meta.hot) {
  hmr.register(import.meta);
  import.meta.hot.accept((mod) => {
    hmr.update(import.meta, mod);
    mod?.settingsIPC().register();
  });
  import.meta.hot.dispose(() => {
    settingsIPC().unregister();
  });
}
