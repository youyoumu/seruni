import { env } from "#/env";
import { AppWindow } from "./_util";

class VnOverlayWindow extends AppWindow {
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

  override async create() {
    super.create();
    this.win?.setIgnoreMouseEvents(false); // set true if you want clicks to pass through
    await this.win?.loadURL(`${env.RENDERER_URL}/vnOverlay`);
    this.win?.setTitle("VN Overlay");
    return true;
  }
}

export const vnOverlayWindow = new VnOverlayWindow();
