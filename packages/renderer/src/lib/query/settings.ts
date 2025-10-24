import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/solid-query";
import { untrack } from "solid-js";
import { queryKey } from "./_util";

export const envQueryOptions = () =>
  queryOptions({
    ...queryKey["settings:env"].detail,
    queryFn: () => {
      return ipcRenderer.invoke("settings:getEnv");
    },
  });
export const useEnvQuery = () =>
  useQuery(() => ({
    ...envQueryOptions(),
  }));

export const isPythonInstalledQueryOptions = () =>
  queryOptions({
    ...queryKey["settings:python"].isInstalled,
    initialData: false,
  });
export const useIsPythonInstalledQuery = () =>
  useQuery(() => ({
    ...isPythonInstalledQueryOptions(),
  }));

export const pythonHealthcheckQueryOptions = () =>
  queryOptions({
    ...queryKey["settings:python"].healthcheck,
    initialData: {},
  });
export const usePythonHealthcheckQuery = () => {
  return useQuery(() => {
    const isPythonInstalledQuery = useIsPythonInstalledQuery();
    isPythonInstalledQuery.isStale;
    return {
      ...pythonHealthcheckQueryOptions(),
      enabled: untrack(() => isPythonInstalledQuery.data === true),
    };
  });
};

export const pythonPipListQueryOptions = () =>
  queryOptions({
    ...queryKey["settings:python"].pipList,
    initialData: [],
  });
export const usePythonPipListQuery = () => {
  return useQuery(() => {
    const isPythonInstalledQuery = useIsPythonInstalledQuery();
    isPythonInstalledQuery.isStale;
    return {
      ...pythonPipListQueryOptions(),
      enabled: untrack(() => isPythonInstalledQuery.data === true),
    };
  });
};

export const useIsUvInstalledQuery = () => {
  const { queryKey, queryFn, initialData } = pythonPipListQueryOptions();
  return useQuery(() => {
    const isPythonInstalledQuery = useIsPythonInstalledQuery();
    isPythonInstalledQuery.isStale;
    return {
      queryKey,
      queryFn,
      initialData,
      select: (data) => data?.some(({ name }) => name === "uv"),
      enabled: untrack(() => isPythonInstalledQuery.data === true),
    };
  });
};

export const pythonVenvPipListQueryOptions = () =>
  queryOptions({
    ...queryKey["settings:python"].venvPipList,
    initialData: [],
  });
export const usePythonVenvPipListQuery = () => {
  return useQuery(() => {
    const isUvInstalledQuery = useIsUvInstalledQuery();
    isUvInstalledQuery.isStale;
    return {
      ...pythonVenvPipListQueryOptions(),
      enabled: untrack(() => isUvInstalledQuery.data === true),
    };
  });
};

export const pythonVenvHealthcheckQueryOptions = () =>
  queryOptions({
    ...queryKey["settings:python"].venvHealthcheck,
    initialData: {},
  });
export const usePythonVenvHealthcheckQuery = () => {
  return useQuery(() => {
    const isUvInstalledQuery = useIsUvInstalledQuery();
    isUvInstalledQuery.isStale;
    return {
      ...pythonVenvHealthcheckQueryOptions(),
      enabled: untrack(() => isUvInstalledQuery.data === true),
    };
  });
};

export const useIsVenvDependeciesInstalledQuery = () => {
  const { queryKey, queryFn, initialData } =
    pythonVenvHealthcheckQueryOptions();
  return useQuery(() => {
    const isUvInstalledQuery = useIsUvInstalledQuery();
    isUvInstalledQuery.isStale;
    return {
      queryKey,
      queryFn,
      initialData,
      select: (data) => data?.ok === true,
      enabled: untrack(() => isUvInstalledQuery.data === true),
    };
  });
};

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
