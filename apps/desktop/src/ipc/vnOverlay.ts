import { signal } from "alien-signals";
import { hmr } from "#/util/hmr";
import { vnOverlayWindow } from "../window/vnOverlay";
import { IPC } from "./_util";

class VnOverlayIPC extends IPC()<"vnOverlay"> {
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

const ipc = signal(new VnOverlayIPC());
export { ipc as vnOverlayIPC };

//  ───────────────────────────────── HMR ─────────────────────────────────

if (import.meta.hot) {
  hmr.register(import.meta.url);
  import.meta.hot.accept((mod) => {
    hmr.update(import.meta.url, mod);
  });
}
