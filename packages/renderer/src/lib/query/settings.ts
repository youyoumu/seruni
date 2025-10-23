import { queryOptions, useQuery } from "@tanstack/solid-query";
import { untrack } from "solid-js";
import { useOwner } from "../util";
import { queryKey } from "./_util";

export const envQueryOptions = () =>
  queryOptions({
    ...queryKey["settings:env"].detail,
    queryFn: () => {
      return ipcRenderer.invoke("settings:getEnv");
    },
  });
export const useEnvQuery = () =>
  useOwner(() => {
    return useQuery(() => ({
      ...envQueryOptions(),
    }));
  });

export const isPythonInstalledQueryOptions = () =>
  queryOptions({
    ...queryKey["settings:python"].isInstalled,
  });
export const useIsPythonInstalledQuery = () =>
  useOwner(() => {
    return useQuery(() => ({
      ...isPythonInstalledQueryOptions(),
    }));
  });

export const pythonHealthcheckQueryOptions = () =>
  queryOptions({
    ...queryKey["settings:python"].healthcheck,
  });
export const usePythonHealthcheckQuery = () =>
  useOwner(() => {
    const isPythonInstalledQuery = useIsPythonInstalledQuery();
    return useQuery(() => ({
      ...pythonHealthcheckQueryOptions(),
      enabled:
        isPythonInstalledQuery().status &&
        untrack(() => isPythonInstalledQuery().data === true),
    }));
  });

export const pythonPipListQueryOptions = () =>
  queryOptions({
    ...queryKey["settings:python"].pipList,
  });
export const usePythonPipListQuery = () =>
  useOwner(() => {
    const isPythonInstalledQuery = useIsPythonInstalledQuery();
    return useQuery(() => ({
      ...pythonPipListQueryOptions(),
      enabled:
        isPythonInstalledQuery().status &&
        untrack(() => isPythonInstalledQuery().data === true),
    }));
  });

export const useIsUvInstalledQuery = () =>
  useOwner(() => {
    const isPythonInstalledQuery = useIsPythonInstalledQuery();
    const { queryKey, queryFn } = pythonPipListQueryOptions();
    return useQuery(() => ({
      queryKey,
      queryFn,
      select: (data) => data.some(({ name }) => name === "uv"),
      enabled:
        isPythonInstalledQuery().status &&
        untrack(() => isPythonInstalledQuery().data === true),
    }));
  });

export const pythonVenvPipListQueryOptions = () =>
  queryOptions({
    ...queryKey["settings:python"].venvPipList,
  });
export const usePythonVenvPipListQuery = () =>
  useOwner(() => {
    const isUvInstalledQuery = useIsUvInstalledQuery();
    return useQuery(() => ({
      ...pythonVenvPipListQueryOptions(),
      enabled:
        isUvInstalledQuery().status &&
        untrack(() => isUvInstalledQuery().data === true),
    }));
  });

export const pythonVenvHealthcheckQueryOptions = () =>
  queryOptions({
    ...queryKey["settings:python"].venvHealthcheck,
  });
export const usePythonVenvHealthcheckQuery = () =>
  useOwner(() => {
    const isUvInstalledQuery = useIsUvInstalledQuery();
    return useQuery(() => ({
      ...pythonVenvHealthcheckQueryOptions(),
      enabled:
        isUvInstalledQuery().status &&
        untrack(() => isUvInstalledQuery().data === true),
    }));
  });

export const useIsVenvDependeciesInstalledQuery = () =>
  useOwner(() => {
    const isUvInstalledQuery = useIsUvInstalledQuery();
    const { queryKey, queryFn } = pythonVenvHealthcheckQueryOptions();
    return useQuery(() => ({
      queryKey,
      queryFn,
      select: (data) => data.ok === true,
      enabled:
        isUvInstalledQuery().status &&
        untrack(() => isUvInstalledQuery().data === true),
    }));
  });
