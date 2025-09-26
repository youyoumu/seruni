import { mainWindow } from "#/window/main";
import { IPC } from "./_util";

class LogIPC extends IPC<"log"> {
  constructor() {
    super({
      prefix: "log",
      win: () => [mainWindow.win],
    });
  }
}

let ipc = new LogIPC();
export { ipc as logIPC };

//  ───────────────────────────────── HMR ─────────────────────────────────

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    ipc.unregister();
  });
  import.meta.hot.accept((mod) => {
    ipc = mod?.logIPC;
    ipc.register();
  });
}
