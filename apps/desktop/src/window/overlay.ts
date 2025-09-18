import { env } from "#/env";
import { AppWindow } from "./_util";

class OverlayWindow extends AppWindow {
  constructor() {
    super({
      width: 800, // adjust to your VN text area
      height: 200,
      frame: false, // no title bar
      transparent: true, // allow transparency
      alwaysOnTop: true, // stays above VN
      skipTaskbar: true, // don’t show in taskbar
      focusable: false, // prevent stealing focus
      webPreferences: {},
      show: false,
    });
  }

  override create() {
    super.create();
    this.win?.setIgnoreMouseEvents(false); // set true if you want clicks to pass through
    this.win?.loadURL(`${env.RENDERER_URL}/overlay`);
  }
}

export const overlayWindow = new OverlayWindow();
