import {
  zAnkiCollectionMediaUrlPath,
  zStorageUrlPath,
} from "@repo/preload/ipc";
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

  const pythonUvPipList = await ipcRenderer.invoke("settings:pythonUvPipList");
  setStore("debug", "python", "pythonUvPipList", pythonUvPipList);
  console.log("DEBUG[772]: pythonUvPipList=", pythonUvPipList);

  const pythonMainCheckhealth = await ipcRenderer.invoke(
    "settings:pythonMainHealthcheck",
  );
  const isDependencyInstalled = pythonMainCheckhealth.ok === true;

  setStore("debug", "python", "pythonMainHealthcheck", pythonMainCheckhealth);
  setStore("debug", "python", "isDependencyInstalled", isDependencyInstalled);
}
