import { env } from "#/env";
import { AppWindow } from "./base";

hmr.log(import.meta.url);

function createVnOverlayWindow() {
  class VnOverlayWindow extends AppWindow() {
    constructor() {
      super({
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
      // this.win?.setIgnoreMouseEvents(true); // set true if you want clicks to pass through
      await this.win?.loadURL(`${env.RENDERER_URL}/vnOverlay`);
      this.win?.setTitle("VN Overlay");
      return true;
    }
  }
  return new VnOverlayWindow();
}

export const vnOverlayWindow = hmr.module(createVnOverlayWindow());

//  ───────────────────────────────── HMR ─────────────────────────────────

if (import.meta.hot) {
  hmr.register(import.meta);
  import.meta.hot.accept((mod) => {
    hmr.update(import.meta, mod);
    mod?.vnOverlayWindow().open();
  });
  import.meta.hot.dispose(() => {
    vnOverlayWindow().win?.close();
  });
}
