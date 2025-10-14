import { vnOverlayWindow } from "../window/vnOverlay";
import { IPC } from "./base";

hmr.log(import.meta);

function createVnOverlayIPC() {
  class VnOverlayIPC extends IPC()<"vnOverlay"> {
    constructor() {
      super({
        prefix: "vnOverlay",
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

export const vnOverlayIPC = hmr.module(createVnOverlayIPC());

//  ───────────────────────────────── HMR ─────────────────────────────────

if (import.meta.hot) {
  const { vnOverlayIPC } = await hmr.register<typeof import("./vnOverlay")>(
    import.meta,
  );
  import.meta.hot.accept((mod) => {
    hmr.update(import.meta, mod);
    vnOverlayIPC().register();
  });
  import.meta.hot.dispose(() => {
    vnOverlayIPC().unregister();
  });
}
