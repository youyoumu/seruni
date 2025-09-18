import { contextBridge, ipcRenderer } from "electron";
import z from "zod";
import { logIPC } from "./ipc/log.js";
import { overlayIPC } from "./ipc/overlay.js";
import { yomitanIPC } from "./ipc/yomitan.js";

const ipcFromRenderer = z.object({
  ...overlayIPC.renderer.shape,
  ...yomitanIPC.renderer.shape,
});
const ipcFromRendererChannel = ipcFromRenderer.keyof();
export type IPCFromRenderer = z.infer<typeof ipcFromRenderer>;
export type IPCFromRendererChannel = z.infer<typeof ipcFromRendererChannel>;

const ipcFromMain = z.object({
  ...logIPC.main.shape,
});
const ipcFromMainChannel = ipcFromMain.keyof();
export type IPCFromMain = z.infer<typeof ipcFromMain>;
export type IPCFromMainChannel = z.infer<typeof ipcFromMainChannel>;

export type IPCRenderer = {
  send: (
    channel: IPCFromRendererChannel,
    ...args: IPCFromRenderer[IPCFromRendererChannel]["input"]
  ) => void;
  on: (
    channel: IPCFromMainChannel,
    callback: (payload: IPCFromMain[IPCFromMainChannel]["output"]) => void,
  ) => void;
};

const ipcRenderer_: IPCRenderer = {
  send: (channel, ...args) => {
    //check if channel valid
    const channelResult = ipcFromRendererChannel.safeParse(channel);
    if (channelResult.error) {
      console.error("Invalid channel", channelResult);
      return;
    }

    //check if args valid
    const argsResult =
      ipcFromRenderer.shape[channel].shape.input.safeParse(args);
    if (argsResult.error) {
      console.error("Invalid args", argsResult);
      return;
    }

    ipcRenderer.send(channel, ...args);
  },
  on: (channel, callback) => {
    ipcRenderer.on(channel, (_, payload) => callback(payload));
  },
};

contextBridge.exposeInMainWorld("ipcRenderer", ipcRenderer_);
