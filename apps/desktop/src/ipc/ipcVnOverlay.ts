import { vnOverlayWindow } from "../window/windowVnOverlay";
import { IPC } from "./ipcBase";

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

export const vnOverlayIPC = hmr.module(new VnOverlayIPC());

//  ───────────────────────────────── HMR ─────────────────────────────────

if (import.meta.hot) {
  const { vnOverlayIPC } = await hmr.register<typeof import("./ipcVnOverlay")>(
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
