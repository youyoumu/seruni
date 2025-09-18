import { app } from "electron";
import { logIPC } from "./ipc/log";
import { overlayIPC } from "./ipc/overlay";
import { yomitanIPC } from "./ipc/yomitan";
import { mainWindow } from "./window/main";

app.whenReady().then(() => {
  logIPC.register();
  overlayIPC.register();
  yomitanIPC.register();

  mainWindow.open();
});
