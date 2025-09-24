import { mainWindow } from "#/window/main";
import { IPC } from "./_util";

class LogIPC extends IPC<"log"> {
  constructor() {
    super({
      prefix: "log",
      win: () => [mainWindow.win],
    });
  }
}

export const logIPC = new LogIPC();
