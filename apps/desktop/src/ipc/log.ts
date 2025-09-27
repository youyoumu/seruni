import { signal } from "alien-signals";
import { hmr } from "#/util/hmr";
import { mainWindow } from "#/window/main";
import { IPC } from "./_util";

function createLogIPC() {
  class LogIPC extends IPC()<"log"> {
    constructor() {
      super({
        prefix: "log",
        win: () => [mainWindow.win],
      });
    }
  }
  return new LogIPC();
}

export const logIPC = signal(createLogIPC());

//  ───────────────────────────────── HMR ─────────────────────────────────

if (import.meta.hot) {
  hmr.register(import.meta.url);
  import.meta.hot.accept((mod) => {
    hmr.update(import.meta.url, mod);
    mod?.logIPC().register();
  });
  import.meta.hot.dispose(() => {
    logIPC().unregister();
  });
}
