//TODO: use register.ts

import { mainWindow } from "#/window/main";
import { vnOverlayWindow } from "#/window/vnOverlay";
import { yomitanWindow } from "#/window/yomitan";

export function registerAllWindow() {
  mainWindow().register();
  yomitanWindow().register();
  vnOverlayWindow().register();
}
