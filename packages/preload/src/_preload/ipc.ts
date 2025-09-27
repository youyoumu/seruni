import { contextBridge } from "electron";
import { ipcRenderer_ } from "#/ipc";

contextBridge.exposeInMainWorld("ipcRenderer", ipcRenderer_);
