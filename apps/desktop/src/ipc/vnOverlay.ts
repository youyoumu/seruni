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

export const vnOverlayIPC = new VnOverlayIPC();
