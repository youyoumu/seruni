import { ipcRenderer } from "electron";
import z from "zod";
import { zGeneralIPC } from "./general";
import { zLogIPC } from "./log";
import { zMiningIPC } from "./mining";
import { zSettingsIPC } from "./settings";
import { zVnOverlayIPC } from "./vnOverlay";
import { zYomitanIPC } from "./yomitan";

export * from "./_shared";
export * from "./general";
export * from "./log";
export * from "./mining";
export * from "./settings";
export * from "./vnOverlay";
export * from "./yomitan";

//  ──────────────────────── From Renderer To Main ────────────────────────
const zIpcFromRenderer = z.object({
  ...zGeneralIPC.renderer.shape,
  ...zVnOverlayIPC.renderer.shape,
  ...zYomitanIPC.renderer.shape,
  ...zSettingsIPC.renderer.shape,
  ...zMiningIPC.renderer.shape,
  ...zLogIPC.renderer.shape,
});
const zIpcFromRendererChannel = zIpcFromRenderer.keyof();
export type IPCFromRenderer = z.infer<typeof zIpcFromRenderer>;
export type IPCFromRendererChannel = z.infer<typeof zIpcFromRendererChannel>;
//  ──────────────────────── From Renderer To Main ────────────────────────

//  ──────────────────────── From Main To Renderer ────────────────────────
const zIpcFromMain = z.object({
  ...zLogIPC.main.shape,
  ...zVnOverlayIPC.main.shape,
});
const ipcFromMainChannel = zIpcFromMain.keyof();
export type IPCFromMain = z.infer<typeof zIpcFromMain>;
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
    const channelResult = zIpcFromRendererChannel.safeParse(channel);
    if (channelResult.error) {
      console.error("Invalid channel", channelResult);
      return;
    }

    //check if args valid
    const argsResult =
      zIpcFromRenderer.shape[channel].shape.input.safeParse(args);
    if (argsResult.error) {
      console.error("Invalid args", argsResult);
      return;
    }

    ipcRenderer.send(channel, ...args);
  },

  //TODO: make this dry
  invoke: async (channel, ...args) => {
    //check if channel valid
    const channelResult = zIpcFromRendererChannel.safeParse(channel);
    if (channelResult.error) {
      console.error("Invalid channel", channelResult);
      return;
    }

    //check if args valid
    const argsResult =
      zIpcFromRenderer.shape[channel].shape.input.safeParse(args);
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
