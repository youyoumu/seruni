import { createQueryKeyStore } from "@lukemorales/query-key-factory";
import type { UseQueryResult } from "@tanstack/solid-query";

export const noUndefinedArray = <T extends unknown[]>(
  query: UseQueryResult<T>,
) => {
  const proxy = new Proxy(query, {
    get(target, prop, receiver) {
      if (prop === "data") {
        return target.data ?? [];
      }
      return Reflect.get(target, prop, receiver);
    },
  });
  return proxy as typeof proxy & { data: NonNullable<typeof proxy.data> };
};

export const queryKey = createQueryKeyStore({
  "mining:noteMedia": {
    one: (noteId: number) => [noteId],
  },
  "settings:env": {
    detail: null,
  },
  "settings:python": {
    isInstalled: {
      queryKey: [undefined],
      queryFn: () => ipcRenderer.invoke("settings:inPythonInstalled"),
    },
    healthcheck: {
      queryKey: [undefined],
      queryFn: () => ipcRenderer.invoke("settings:pythonHealthcheck"),
    },
    pipList: {
      queryKey: [undefined],
      queryFn: () => ipcRenderer.invoke("settings:pythonPipList"),
    },
    venvPipList: {
      queryKey: [undefined],
      queryFn: () => ipcRenderer.invoke("settings:pythonVenvPipList"),
    },
    venvHealthcheck: {
      queryKey: [undefined],
      queryFn: () => ipcRenderer.invoke("settings:pythonVenvHealthcheck"),
    },
  },
  "general:httpServerUrl": {
    value: null,
  },
});
