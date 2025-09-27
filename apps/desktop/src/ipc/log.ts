import { signal } from "alien-signals";
import { hmr } from "#/util/hmr";
import { mainWindow } from "#/window/main";
import { IPC } from "./_util";

class LogIPC extends IPC()<"log"> {
  constructor() {
    super({
      prefix: "log",
      win: () => [mainWindow.win],
    });
  }
}

const ipc = signal(new LogIPC());
export { ipc as logIPC };

//  ───────────────────────────────── HMR ─────────────────────────────────

if (import.meta.hot) {
  hmr.register(import.meta.url);
  import.meta.hot.accept((mod) => {
    hmr.update(import.meta.url, mod);
  });
}
