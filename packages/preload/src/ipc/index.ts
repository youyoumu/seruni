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
export const zIpcFromRenderer = z.object({
  ...zGeneralIPC.renderer.shape,
  ...zVnOverlayIPC.renderer.shape,
  ...zYomitanIPC.renderer.shape,
  ...zSettingsIPC.renderer.shape,
  ...zMiningIPC.renderer.shape,
  ...zLogIPC.renderer.shape,
});
export const zIpcFromRendererChannel = zIpcFromRenderer.keyof();
export type IPCFromRenderer = z.infer<typeof zIpcFromRenderer>;
export type IPCFromRendererChannel = z.infer<typeof zIpcFromRendererChannel>;
//  ──────────────────────── From Renderer To Main ────────────────────────

//  ──────────────────────── From Main To Renderer ────────────────────────
const zIpcFromMain = z.object({
  ...zLogIPC.main.shape,
  ...zMiningIPC.main.shape,
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
