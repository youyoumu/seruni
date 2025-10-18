import { debounce } from "es-toolkit";
import type { MessageContext } from "roarr";
import { env } from "#/env";
import { yomitanExtension } from "#/extension/yomitan";
import { python } from "#/runner/python";
import { config } from "#/util/config";
import { log } from "#/util/logger";
import { IPC } from "./base";
import { vnOverlayIPC } from "./vnOverlay";

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

    this.handle("settings:installPython", async (_) => {
      try {
        await python().install();
        return true;
      } catch {
        return false;
      }
    });

    this.on("settings:runPython", async (_, payload) => {
      await python().run(payload);
    });

    this.handle("settings:inPythonInstalled", async () => {
      return await python().isPythonInstalled();
    });

    this.handle("settings:isYomitanInstalled", async () => {
      return yomitanExtension.isInstalled();
    });
  }
}

export const settingsIPC = hmr.module(new SettingsIPC());

//  ───────────────────────────────── HMR ─────────────────────────────────

if (import.meta.hot) {
  const { settingsIPC } = await hmr.register<typeof import("./settings")>(
    import.meta,
  );
  import.meta.hot.accept((mod) => {
    hmr.update(import.meta, mod);
    settingsIPC().register();
  });
  import.meta.hot.dispose(() => {
    settingsIPC().unregister();
  });
}
