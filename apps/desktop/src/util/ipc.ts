import { generalIPC } from "#/ipc/general";
import { logIPC } from "#/ipc/log";
import { miningIPC } from "#/ipc/mining";
import { settingsIPC } from "#/ipc/settings";
import { vnOverlayIPC } from "#/ipc/vnOverlay";
import { yomitanIPC } from "#/ipc/yomitan";

export function registerAllIPC() {
  generalIPC().register();
  logIPC().register();
  miningIPC().register();
  settingsIPC().register();
  vnOverlayIPC().register();
  yomitanIPC().register();
}
