import {
  createQueryKeys,
  mergeQueryKeys,
} from "@lukemorales/query-key-factory";
import type { UseQueryResult } from "@tanstack/solid-query";

export type Query = Record<
  string,
  Partial<Record<"options" | "use" | "placeholderData", unknown>>
>;
export type Mutation = Record<string, unknown>;

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

const mining = [
  createQueryKeys("mining:noteMedia", {
    one: (noteId) => ({
      queryKey: [noteId],
      queryFn: () => ipcRenderer.invoke("mining:getNoteMedia", { noteId }),
    }),
  }),
  createQueryKeys("mining:obs", {
    sourceScreenshot: {
      queryKey: [undefined],
      queryFn: () => ipcRenderer.invoke("mining:getSourceScreenshot"),
    },
    replayBufferStartTime: {
      queryKey: [undefined],
      queryFn: () => ipcRenderer.invoke("mining:getReplayBufferStartTime"),
    },
    replayBufferDuration: {
      queryKey: [undefined],
      queryFn: () => ipcRenderer.invoke("mining:getReplayBufferDuration"),
    },
  }),
  createQueryKeys("mining:session", {
    textHistory: {
      queryKey: [undefined],
      queryFn: () => ipcRenderer.invoke("mining:getTextHistory"),
    },
  }),
  createQueryKeys("mining:ankiHistory", {
    all: {
      queryKey: [undefined],
      queryFn: () => ipcRenderer.invoke("mining:getAnkiHistory"),
    },
  }),
] as const;

const settings = [
  createQueryKeys("settings:env", {
    detail: {
      queryKey: [undefined],
      queryFn: () => ipcRenderer.invoke("settings:getEnv"),
    },
    ankiCollectionMediaDir: {
      queryKey: [undefined],
      queryFn: () => ipcRenderer.invoke("settings:ankiCollectionMediaDir"),
    },
  }),
  createQueryKeys("settings:config", {
    detail: {
      queryKey: [undefined],
      queryFn: () => ipcRenderer.invoke("settings:getConfig"),
    },
    isYomitanInstalled: {
      queryKey: [undefined],
      queryFn: () => ipcRenderer.invoke("settings:isYomitanInstalled"),
    },
  }),
  createQueryKeys("settings:python", {
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
  }),
] as const;

const general = [
  createQueryKeys("general:httpServerUrl", {
    value: {
      queryKey: [undefined],
      queryFn: () => ipcRenderer.invoke("general:httpServerUrl"),
    },
  }),
  createQueryKeys("general:clientStatus", {
    detail: {
      queryKey: [undefined],
      queryFn: () => ipcRenderer.invoke("general:getClientStatus"),
    },
  }),
] as const;

export const keyStore = mergeQueryKeys(...general, ...mining, ...settings);
