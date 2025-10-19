import {
  zAnkiCollectionMediaUrlPath,
  zStorageUrlPath,
} from "@repo/preload/ipc";
import { createSignal, onCleanup, onMount } from "solid-js";
import { setStore, store } from "./store";

export function getMediaUrl(fileName: string, source: "anki" | "storage") {
  if (source === "anki") {
    return `${store.general.httpServerUrl}${zAnkiCollectionMediaUrlPath.value}${fileName}`;
  } else if (source === "storage") {
    return `${store.general.httpServerUrl}${zStorageUrlPath.value}${fileName}`;
  }
  return "";
}

export async function checkPython() {
  const isPythonInstalled =
    (await ipcRenderer.invoke("settings:inPythonInstalled")) === true;
  setStore("debug", "python", "isInstalled", isPythonInstalled);
  if (!isPythonInstalled) return;

  const pythonHealthcheck = await ipcRenderer.invoke(
    "settings:pythonHealthcheck",
  );
  setStore("debug", "python", "pythonHealthcheck", pythonHealthcheck);

  const pythonPipList = await ipcRenderer.invoke("settings:pythonPipList");
  const isUvInstalled = pythonPipList.some(({ name }) => name === "uv");
  setStore("debug", "python", "pythonPipList", pythonPipList);
  setStore("debug", "python", "isUvInstalled", isUvInstalled);
  if (!isUvInstalled) return;

  const pythonVenvPipList = await ipcRenderer.invoke(
    "settings:pythonVenvPipList",
  );
  setStore("debug", "python", "pythonVenvPipList", pythonVenvPipList);

  const pythonVenvHealthcheck = await ipcRenderer.invoke(
    "settings:pythonVenvHealthcheck",
  );
  const isDependencyInstalled = pythonVenvHealthcheck.ok === true;

  setStore("debug", "python", "pythonVenvHealthcheck", pythonVenvHealthcheck);
  setStore("debug", "python", "isDependencyInstalled", isDependencyInstalled);
}
