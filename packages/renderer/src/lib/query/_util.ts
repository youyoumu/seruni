import { createQueryKeyStore } from "@lukemorales/query-key-factory";
import type { UseQueryResult } from "@tanstack/solid-query";

export const queryWithPlaceholderData = <T>(
  query: UseQueryResult<T>,
  placeholderData: T,
) => {
  const proxy = new Proxy(query, {
    get(target, prop, receiver) {
      if (prop === "data") {
        return target.data === undefined ? placeholderData : target.data;
      }
      return Reflect.get(target, prop, receiver);
    },
  });
  return proxy as typeof proxy & { data: T };
};

export const queryKey = createQueryKeyStore({
  "mining:noteMedia": {
    one: (noteId) => ({
      queryKey: [noteId],
      queryFn: () => ipcRenderer.invoke("mining:getNoteMedia", { noteId }),
    }),
  },
  "settings:env": {
    detail: {
      queryKey: [undefined],
      queryFn: () => ipcRenderer.invoke("settings:getEnv"),
    },
  },
  "settings:python": {
    isInstalled: {
      queryKey: [undefined],
      queryFn: () => ipcRenderer.invoke("settings:isPythonInstalled"),
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
    value: {
      queryKey: [undefined],
      queryFn: () => ipcRenderer.invoke("general:httpServerUrl"),
    },
  },
  "general:clientStatus": {
    detail: {
      queryKey: [undefined],
      queryFn: () => ipcRenderer.invoke("general:getClientStatus"),
    },
  },
});
