import { getOwner, runWithOwner } from "solid-js";
import { setStore } from "./store";

export function useOwner<T>(fn: () => T): () => T {
  const owner = getOwner();
  return () => runWithOwner(owner, fn) as T;
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
