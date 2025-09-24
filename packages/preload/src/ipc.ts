import { contextBridge, ipcRenderer } from "electron";
import z from "zod";
import { logIPC } from "./ipc/log.js";
import { settingsIPC } from "./ipc/settings.js";
import { vnOverlayIPC } from "./ipc/vnOverlay.js";
import { yomitanIPC } from "./ipc/yomitan.js";

const ipcFromRenderer = z.object({
  ...vnOverlayIPC.renderer.shape,
  ...yomitanIPC.renderer.shape,
  ...settingsIPC.renderer.shape,
});
const ipcFromRendererChannel = ipcFromRenderer.keyof();
export type IPCFromRenderer = z.infer<typeof ipcFromRenderer>;
export type IPCFromRendererChannel = z.infer<typeof ipcFromRendererChannel>;

const ipcFromMain = z.object({
  ...logIPC.main.shape,
  ...vnOverlayIPC.main.shape,
});
const ipcFromMainChannel = ipcFromMain.keyof();
export type IPCFromMain = z.infer<typeof ipcFromMain>;
export type IPCFromMainChannel = z.infer<typeof ipcFromMainChannel>;

export type IPCRendererHandler<Channel extends IPCFromMainChannel> = (
  payload: IPCFromMain[Channel]["output"],
) => void;
export type IPCRenderer = {
  send: <C extends IPCFromRendererChannel>(
    channel: C,
    ...args: IPCFromRenderer[C]["input"]
  ) => void;

  on: <C extends IPCFromMainChannel>(
    channel: C,
    handler: IPCRendererHandler<C>,
  ) => void;

  removeListener: <C extends IPCFromMainChannel>(
    channel: C,
    handler: IPCRendererHandler<C>,
  ) => void;
};

type Fn = () => void;
const listenerMap = new WeakMap<Fn, Fn>();

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

  on: (channel, handler) => {
    const wrappedHandler = (
      _: unknown,
      payload: Parameters<typeof handler>[0],
    ) => handler(payload);
    listenerMap.set(handler as Fn, wrappedHandler as Fn);
    ipcRenderer.on(channel, wrappedHandler);
  },

  removeListener: (channel, callback) => {
    const wrappedHandler = listenerMap.get(callback as Fn);
    if (wrappedHandler) {
      ipcRenderer.removeListener(channel, wrappedHandler);
      listenerMap.delete(callback as Fn);
    }
    ipcRenderer.removeListener(channel, (_, payload) => callback(payload));
  },
};

contextBridge.exposeInMainWorld("ipcRenderer", ipcRenderer_);
