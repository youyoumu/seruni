import { vnOverlayWindow } from "../window/vnOverlay";
import { IPC } from "./_util";

class VnOverlayIPC extends IPC<"vnOverlay"> {
  constructor() {
    super({
      prefix: "vnOverlay",
      win: () => [vnOverlayWindow.win],
    });
  }

  override register() {
    this.on("vnOverlay:open", () => {
      vnOverlayWindow.open();
    });

    this.on("vnOverlay:minimize", () => {
      vnOverlayWindow.win?.minimize();
    });
  }
}

let ipc = new VnOverlayIPC();
export { ipc as vnOverlayIPC };

//  ───────────────────────────────── HMR ─────────────────────────────────

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    ipc.unregister();
  });
  import.meta.hot.accept((mod) => {
    ipc = mod?.vnOverlayIPC;
    ipc.register();
  });
}
