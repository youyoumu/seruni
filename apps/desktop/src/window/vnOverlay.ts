import { signal } from "alien-signals";
import { env } from "#/env";
import { AppWindow } from "./base";

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

export const vnOverlayWindow = signal(createVnOverlayWindow());

//  ───────────────────────────────── HMR ─────────────────────────────────

if (import.meta.hot) {
  hmr.register(import.meta.url);
  import.meta.hot.accept((mod) => {
    hmr.update(import.meta.url, mod);
    mod?.vnOverlayWindow().open();
  });
  import.meta.hot.dispose(() => {
    vnOverlayWindow().win?.close();
  });
}
