import { overlayWindow } from "../window/overlay";
import { IPC } from "./_util";

class OverlayIPC extends IPC<"overlay"> {
  constructor() {
    super({
      prefix: "overlay",
      win: () => overlayWindow.win,
    });
  }

  override register() {
    this.on("overlay:open", () => {
      overlayWindow.open();
    });

    this.on("overlay:minimize", () => {
      overlayWindow.win?.minimize();
    });
  }
}

export const overlayIPC = new OverlayIPC();
