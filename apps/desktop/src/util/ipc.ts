import { generalIPC } from "#/ipc/ipcGeneral";
import { logIPC } from "#/ipc/ipcLog";
import { miningIPC } from "#/ipc/ipcMining";
import { settingsIPC } from "#/ipc/ipcSettings";
import { vnOverlayIPC } from "#/ipc/ipcVnOverlay";
import { yomitanIPC } from "#/ipc/ipcYomitan";

export function registerAllIPC() {
  generalIPC().register();
  logIPC().register();
  miningIPC().register();
  settingsIPC().register();
  vnOverlayIPC().register();
  yomitanIPC().register();
}
