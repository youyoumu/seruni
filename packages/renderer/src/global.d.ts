import type { IPCRenderer } from "@repo/preload/ipc";

declare global {
  var ipcRenderer: IPCRenderer;
}
