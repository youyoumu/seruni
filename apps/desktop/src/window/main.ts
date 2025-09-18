import { env } from "#/env";
import { AppWindow } from "./_util";

class MainWindow extends AppWindow {
  constructor() {
    super({
      width: 1280,
      height: 1000,
    });
  }

  override create() {
    super.create();
    this.win?.loadURL(env.RENDERER_URL);
  }
}

export const mainWindow = new MainWindow();
