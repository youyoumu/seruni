import { signal } from "alien-signals";
import { hmr } from "#/util/hmr";
import { vnOverlayWindow } from "../window/vnOverlay";
import { IPC } from "./base";

function createVnOverlayIPC() {
  class VnOverlayIPC extends IPC()<"vnOverlay"> {
    constructor() {
      super({
        prefix: "vnOverlay",
        win: () => [vnOverlayWindow().win],
      });
    }

    override register() {
      this.on("vnOverlay:open", () => {
        vnOverlayWindow().open();
      });

      this.on("vnOverlay:minimize", () => {
        vnOverlayWindow().win?.minimize();
      });
    }
  }
  return new VnOverlayIPC();
}

export const vnOverlayIPC = signal(createVnOverlayIPC());

//  ───────────────────────────────── HMR ─────────────────────────────────

if (import.meta.hot) {
  hmr.register(import.meta.url);
  import.meta.hot.accept((mod) => {
    hmr.update(import.meta.url, mod);
    mod?.vnOverlayIPC().register();
  });
  import.meta.hot.dispose(() => {
    vnOverlayIPC().unregister();
  });
}
