import { ankiClient } from "#/client/anki";
import { obsClient } from "#/client/obs";
import { textractorClient } from "#/client/textractor";
import { IPC } from "./base";

hmr.log(import.meta);

function createGeneralIPC() {
  class GeneralIPC extends IPC()<"general"> {
    ready = Promise.withResolvers<boolean>();
    constructor() {
      super({
        prefix: "general",
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

export const generalIPC = hmr.module(createGeneralIPC());

//  ───────────────────────────────── HMR ─────────────────────────────────

if (import.meta.hot) {
  hmr.register(import.meta);
  import.meta.hot.accept((mod) => {
    hmr.update(import.meta, mod);
    mod?.generalIPC().register();
  });
  import.meta.hot.dispose(() => {
    generalIPC().unregister();
  });
}
