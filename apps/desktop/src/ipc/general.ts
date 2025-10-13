import { signal } from "alien-signals";
import { ankiClient, obsClient, textractorClient } from "#/client";
import { mainWindow } from "#/window/main";
import { IPC } from "./base";

function createGeneralIPC() {
  class GeneralIPC extends IPC()<"general"> {
    ready = Promise.withResolvers<boolean>();
    constructor() {
      super({
        prefix: "general",
        win: () => [mainWindow().win],
      });
    }

    override register() {
      this.on("general:ready", (_) => {
        this.ready.resolve(true);
      });

      this.handle("general:getClientStatus", async () => {
        return {
          anki: ankiClient().status,
          obs: obsClient().status,
          textractor: textractorClient().status,
        };
      });
    }
  }

  return new GeneralIPC();
}

export const generalIPC = signal(createGeneralIPC());

//  ───────────────────────────────── HMR ─────────────────────────────────

if (import.meta.hot) {
  hmr.register(import.meta.url);
  import.meta.hot.accept((mod) => {
    hmr.update(import.meta.url, mod);
    mod?.generalIPC().register();
  });
  import.meta.hot.dispose(() => {
    generalIPC().unregister();
  });
}
