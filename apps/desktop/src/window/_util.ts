import { BrowserWindow } from "electron";
import { env } from "#/env";

type BrowserWindowOptions = ConstructorParameters<typeof BrowserWindow>[0];
export class AppWindow {
  options: BrowserWindowOptions;
  win: BrowserWindow | undefined;

  constructor(options: BrowserWindowOptions) {
    options = options ?? {};
    const overrideOptions: BrowserWindowOptions = {
      webPreferences: {
        preload: env.PRELOAD_PATH,
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
  }

  async open() {
    if (!this.win || this.win.isDestroyed()) {
      await this.create();
    }
    this.win?.show();
  }
}
