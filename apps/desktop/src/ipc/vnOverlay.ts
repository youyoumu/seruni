import { vnOverlayWindow } from "../window/vnOverlay";
import { IPC } from "./_util";

class VnOverlayIPC extends IPC<"vn:overlay"> {
  constructor() {
    super({
      prefix: "vn:overlay",
      win: () => vnOverlayWindow.win,
    });
  }

  override register() {
    this.on("vn:overlay:open", () => {
      vnOverlayWindow.open();
    });

    this.on("vn:overlay:minimize", () => {
      vnOverlayWindow.win?.minimize();
    });
  }
}

export const vnOverlayIPC = new VnOverlayIPC();
