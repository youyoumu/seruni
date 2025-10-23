import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/solid-query";
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
    initialData: false,
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
    initialData: {},
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
    initialData: [],
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
    const { queryKey, queryFn, initialData } = pythonPipListQueryOptions();
    return useQuery(() => ({
      queryKey,
      queryFn,
      initialData,
      select: (data) => data?.some(({ name }) => name === "uv"),
      enabled:
        isPythonInstalledQuery().status &&
        untrack(() => isPythonInstalledQuery().data === true),
    }));
  });

export const pythonVenvPipListQueryOptions = () =>
  queryOptions({
    ...queryKey["settings:python"].venvPipList,
    initialData: [],
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
    initialData: {},
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
    const { queryKey, queryFn, initialData } =
      pythonVenvHealthcheckQueryOptions();
    return useQuery(() => ({
      queryKey,
      queryFn,
      initialData,
      select: (data) => data?.ok === true,
      enabled:
        isUvInstalledQuery().status &&
        untrack(() => isUvInstalledQuery().data === true),
    }));
  });

export const useInstallPythonMutation = () =>
  useMutation(() => {
    const queryClient = useQueryClient();
    return {
      mutationFn: () => ipcRenderer.invoke("settings:installPython"),
      onSuccess: async () => {
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: queryKey["settings:python"].isInstalled.queryKey,
          }),
          queryClient.invalidateQueries({
            queryKey: queryKey["settings:python"].healthcheck.queryKey,
          }),
          queryClient.invalidateQueries({
            queryKey: queryKey["settings:python"].pipList.queryKey,
          }),
        ]);
      },
    };
  });

export const useInstallPythonUvMutation = () =>
  useMutation(() => {
    const queryClient = useQueryClient();
    return {
      mutationFn: () => ipcRenderer.invoke("settings:installPythonUv"),
      onSuccess: async () => {
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: queryKey["settings:python"].healthcheck.queryKey,
          }),
          queryClient.invalidateQueries({
            queryKey: queryKey["settings:python"].pipList.queryKey,
          }),
          queryClient.invalidateQueries({
            queryKey: queryKey["settings:python"].venvHealthcheck.queryKey,
          }),
          queryClient.invalidateQueries({
            queryKey: queryKey["settings:python"].venvPipList.queryKey,
          }),
        ]);
      },
    };
  });

export const useInstallPythonDependenciesMutation = () =>
  useMutation(() => {
    const queryClient = useQueryClient();
    return {
      mutationFn: () =>
        ipcRenderer.invoke("settings:installPythonDependencies"),
      onSuccess: async () => {
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: queryKey["settings:python"].venvHealthcheck.queryKey,
          }),
          queryClient.invalidateQueries({
            queryKey: queryKey["settings:python"].venvPipList.queryKey,
          }),
        ]);
      },
    };
  });
