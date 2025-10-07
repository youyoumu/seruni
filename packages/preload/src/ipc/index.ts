import { ipcRenderer } from "electron";
import z from "zod";
import { generalIPC } from "./general";
import { logIPC } from "./log";
import { settingsIPC } from "./settings";
import { vnOverlayIPC } from "./vnOverlay";
import { yomitanIPC } from "./yomitan";

export { logIPC, settingsIPC, vnOverlayIPC, yomitanIPC };

//  ──────────────────────── From Renderer To Main ────────────────────────
const ipcFromRenderer = z.object({
  ...generalIPC.renderer.shape,
  ...vnOverlayIPC.renderer.shape,
  ...yomitanIPC.renderer.shape,
  ...settingsIPC.renderer.shape,
});
const ipcFromRendererChannel = ipcFromRenderer.keyof();
export type IPCFromRenderer = z.infer<typeof ipcFromRenderer>;
export type IPCFromRendererChannel = z.infer<typeof ipcFromRendererChannel>;
//  ──────────────────────── From Renderer To Main ────────────────────────

//  ──────────────────────── From Main To Renderer ────────────────────────
const ipcFromMain = z.object({
  ...logIPC.main.shape,
  ...vnOverlayIPC.main.shape,
});
const ipcFromMainChannel = ipcFromMain.keyof();
export type IPCFromMain = z.infer<typeof ipcFromMain>;
export type IPCFromMainChannel = z.infer<typeof ipcFromMainChannel>;
//  ──────────────────────── From Main To Renderer ────────────────────────

export type IPCRendererHandler<Channel extends IPCFromMainChannel> = (
  ...payload: IPCFromMain[Channel]["input"]
) => void;
export type IPCRenderer = {
  send: <C extends IPCFromRendererChannel>(
    channel: C,
    ...args: IPCFromRenderer[C]["input"]
  ) => void;

  invoke: <C extends IPCFromRendererChannel>(
    channel: C,
    ...args: IPCFromRenderer[C]["input"]
  ) => Promise<IPCFromRenderer[C]["output"]>;

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

export const ipcRenderer_: IPCRenderer = {
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

  //TODO: make this dry
  invoke: async (channel, ...args) => {
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

    return await ipcRenderer.invoke(channel, ...args);
  },

  on: (channel, handler) => {
    const wrappedHandler = (
      _: unknown,
      ...payload: Parameters<typeof handler>
    ) => handler(...payload);
    listenerMap.set(handler as Fn, wrappedHandler as Fn);
    ipcRenderer.on(channel, wrappedHandler);
  },

  removeListener: (channel, callback) => {
    const wrappedHandler = listenerMap.get(callback as Fn);
    if (wrappedHandler) {
      ipcRenderer.removeListener(channel, wrappedHandler);
      listenerMap.delete(callback as Fn);
    }
  },
};
