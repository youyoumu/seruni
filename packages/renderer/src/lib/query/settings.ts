import { queryOptions, useQuery } from "@tanstack/solid-query";
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
      enabled: isPythonInstalledQuery().data === true,
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
      enabled: isPythonInstalledQuery().data === true,
    }));
  });

export const isUvInstalledQueryOptions = () => {
  const { queryKey, queryFn } = pythonPipListQueryOptions();
  return queryOptions({
    queryKey,
    queryFn,
    select: (data) => data.some(({ name }) => name === "uv"),
  });
};
export const useIsUvInstalledQuery = () =>
  useOwner(() => {
    const isPythonInstalledQuery = useIsPythonInstalledQuery();
    return useQuery(() => ({
      ...isUvInstalledQueryOptions(),
      enabled: isPythonInstalledQuery().data === true,
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
      enabled: isUvInstalledQuery().data === true,
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
      enabled: isUvInstalledQuery().data === true,
    }));
  });

export const isVenvDependeciesInstalledQueryOptions = () => {
  const { queryKey, queryFn } = pythonVenvHealthcheckQueryOptions();
  return queryOptions({
    queryKey,
    queryFn,
    select: (data) => data.ok === true,
  });
};
export const useIsVenvDependeciesInstalledQuery = () =>
  useOwner(() => {
    const isUvInstalledQuery = useIsUvInstalledQuery();
    return useQuery(() => ({
      ...isVenvDependeciesInstalledQueryOptions(),
      enabled: isUvInstalledQuery().data === true,
    }));
  });
