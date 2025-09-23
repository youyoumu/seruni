import type {
  IPCFromMain,
  IPCFromMainChannel,
  IPCFromRenderer,
  IPCFromRendererChannel,
} from "@repo/preload/ipc";
import { type BrowserWindow, ipcMain } from "electron";

type ChannelsWithPrefix<
  All extends string,
  Prefix extends string,
> = All extends `${Prefix}:${string}` ? All : never;

export class IPC<Prefix extends string> {
  prefix: Prefix;
  #win: () => BrowserWindow | undefined;

  constructor(options: {
    prefix: Prefix;
    win: () => BrowserWindow | undefined;
  }) {
    this.prefix = options.prefix;
    this.#win = options.win;
  }

  on<K extends ChannelsWithPrefix<IPCFromRendererChannel, Prefix>>(
    channel: K,
    listener: (
      event: Electron.IpcMainEvent,
      ...args: IPCFromRenderer[K]["input"]
    ) => IPCFromRenderer[K]["output"],
  ) {
    ipcMain.on(channel, (event, ...args) =>
      listener(event, ...(args as IPCFromRenderer[K]["input"])),
    );
  }

  register() {}

  send<K extends IPCFromMainChannel>(
    channel: K,
    payload: IPCFromMain[K]["output"],
  ) {
    this.#win()?.webContents.send(channel, payload);
  }
}
