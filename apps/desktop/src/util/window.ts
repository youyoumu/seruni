//TODO: use register.ts

import { mainWindow } from "#/window/windowMain";
import { vnOverlayWindow } from "#/window/windowVnOverlay";
import { yomitanWindow } from "#/window/windowYomitan";

export function registerAllWindow() {
  mainWindow().register();
  yomitanWindow().register();
  vnOverlayWindow().register();
}
