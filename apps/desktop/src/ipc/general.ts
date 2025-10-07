import { signal } from "alien-signals";
import { hmr } from "#/util/hmr";
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
    mod?.settingsIPC().register();
  });
  import.meta.hot.dispose(() => {
    generalIPC().unregister();
  });
}
