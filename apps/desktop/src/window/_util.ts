import { signal } from "alien-signals";
import { BrowserWindow } from "electron";
import { env } from "#/env";
import { hmr } from "#/util/hmr";

type BrowserWindowOptions = ConstructorParameters<typeof BrowserWindow>[0];
function createAppWindowClass() {
  class AppWindow {
    options: BrowserWindowOptions;
    win: BrowserWindow | undefined;

    constructor(options: BrowserWindowOptions) {
      options = options ?? {};
      const overrideOptions: BrowserWindowOptions = {
        webPreferences: {
          preload: env.IPC_PRELOAD_PATH,
        },
      };
      Object.assign(options, overrideOptions);
      this.options = options;
    }

    async create() {
      this.win = new BrowserWindow(this.options);

      this.win.on("closed", () => {
        this.win = undefined;
      });
      return true;
    }

    async open() {
      let ready = true;
      if (!this.win || this.win.isDestroyed()) {
        ready = await this.create();
      }
      if (ready) {
        this.win?.show();
      }
    }
  }

  return AppWindow;
}

export const AppWindow = signal(createAppWindowClass());

//  ───────────────────────────────── HMR ─────────────────────────────────

if (import.meta.hot) {
  hmr.register(import.meta.url);
  import.meta.hot.accept((mod) => {
    hmr.update(import.meta.url, mod);
    import.meta.hot?.invalidate();
  });
}
