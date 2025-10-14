import { contextBridge, ipcRenderer } from "electron";
import {
  type IPCRenderer,
  zIpcFromRenderer,
  zIpcFromRendererChannel,
} from "#/ipc";

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

contextBridge.exposeInMainWorld("ipcRenderer", ipcRenderer_);
