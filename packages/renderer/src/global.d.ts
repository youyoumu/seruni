import type { IPCRenderer } from "@repo/preload";

declare global {
  var ipcRenderer: IPCRenderer;
}
