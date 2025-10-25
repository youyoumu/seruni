import { type Config, defaultConfig } from "@repo/preload/ipc";
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/solid-query";
import { reconcile } from "solid-js/store";
import { keyStore, type Mutation, type Query } from "./_util";

const PythonQuery = {
  // biome-ignore format: this looks nicer
  isInstalled: {
    options: () => queryOptions({ ...keyStore["settings:python"].isInstalled, placeholderData: false, }),
    use: () => useQuery(() => ({ ...PythonQuery.isInstalled.options() })),
  },

  // biome-ignore format: this looks nicer
  healthcheck: {
    options: () => queryOptions({ ...keyStore["settings:python"].healthcheck, placeholderData: {}, }),
    use: () =>
      useQuery(() => {
        const installed = PythonQuery.isInstalled.use();
        installed.isStale;
        return { ...PythonQuery.healthcheck.options(), enabled: () => installed.data === true, };
      }),
  },

  // biome-ignore format: this looks nicer
  pipList: {
    options: () => queryOptions({ ...keyStore["settings:python"].pipList, placeholderData: [], }),
    use: () =>
      useQuery(() => {
        const installed = PythonQuery.isInstalled.use();
        installed.isStale;
        return { ...PythonQuery.pipList.options(), enabled: () => installed.data === true, };
      }),
  },

  // biome-ignore format: this looks nicer
  isUvInstalled: {
    use: () =>
      useQuery(() => {
        const installed = PythonQuery.isInstalled.use();
        installed.isStale;
        const { queryKey, queryFn, placeholderData } = PythonQuery.pipList.options();
        return { queryKey, queryFn, placeholderData,
          select: (data) => data?.some((p) => p.name === "uv"),
          enabled: () => installed.data === true,
        };
      }),
  },

  // biome-ignore format: this looks nicer
  venvPipList: {
    options: () => queryOptions({ ...keyStore["settings:python"].venvPipList, placeholderData: [], }),
    use: () =>
      useQuery(() => {
        const uv = PythonQuery.isUvInstalled.use();
        uv.isStale;
        return { ...PythonQuery.venvPipList.options(), enabled: () => uv.data === true, };
      }),
  },

  // biome-ignore format: this looks nicer
  venvHealthcheck: {
    options: () => queryOptions({ ...keyStore["settings:python"].venvHealthcheck, placeholderData: {}, }),
    use: () =>
      useQuery(() => {
        const uv = PythonQuery.isUvInstalled.use();
        uv.isStale;
        return { ...PythonQuery.venvHealthcheck.options(), enabled: () => uv.data === true, };
      }),
  },

  // biome-ignore format: this looks nicer
  venvDependenciesInstalled: {
    use: () =>
      useQuery(() => {
        const { queryKey, queryFn, placeholderData } = PythonQuery.venvHealthcheck.options();
        const uv = PythonQuery.isUvInstalled.use();
        uv.isStale;
        return { queryKey, queryFn, placeholderData,
          select: (data) => data?.ok === true,
          enabled: () => uv.data === true,
        };
      }),
  },
} satisfies Query;

const PythonMutation = {
  // biome-ignore format: this looks nicer
  installPython: () =>
    useMutation(() => {
      const qc = useQueryClient();
      return {
        mutationFn: () => ipcRenderer.invoke("settings:installPython"),
        onSuccess: async () => await Promise.all([
            qc.invalidateQueries({ queryKey: keyStore["settings:python"].isInstalled.queryKey, }),
            qc.invalidateQueries({ queryKey: keyStore["settings:python"].healthcheck.queryKey, }),
            qc.invalidateQueries({ queryKey: keyStore["settings:python"].pipList.queryKey, }),
          ]),
      };
    }),

  // biome-ignore format: this looks nicer
  installUv: () =>
    useMutation(() => {
      const qc = useQueryClient();
      return {
        mutationFn: () => ipcRenderer.invoke("settings:installPythonUv"),
        onSuccess: async () => await Promise.all([
            qc.invalidateQueries({ queryKey: keyStore["settings:python"].healthcheck.queryKey, }),
            qc.invalidateQueries({ queryKey: keyStore["settings:python"].pipList.queryKey, }),
            qc.invalidateQueries({ queryKey: keyStore["settings:python"].venvHealthcheck.queryKey, }),
            qc.invalidateQueries({ queryKey: keyStore["settings:python"].venvPipList.queryKey, }),
          ]),
      };
    }),

  // biome-ignore format: this looks nicer
  installDependencies: () =>
    useMutation(() => {
      const qc = useQueryClient();
      return {
        mutationFn: () => ipcRenderer.invoke("settings:installPythonDependencies"),
        onSuccess: async () => await Promise.all([
            qc.invalidateQueries({ queryKey: keyStore["settings:python"].venvHealthcheck.queryKey, }),
            qc.invalidateQueries({ queryKey: keyStore["settings:python"].venvPipList.queryKey, }),
          ]),
      };
    }),
} satisfies Mutation;

const EnvQuery = {
  // biome-ignore format: this looks nicer
  detail: {
    options: () => queryOptions({ ...keyStore["settings:env"].detail, placeholderData: {}, }),
    use: () => useQuery(() => ({ ...EnvQuery.detail.options() })),
  },
} satisfies Query;

const ConfigQuery = {
  // biome-ignore format: this looks nicer
  detail: {
    options: () => queryOptions({ ...keyStore["settings:config"].detail, placeholderData: defaultConfig, reconcile: (old, data) => reconcile(data)(old), }),
    use: () => useQuery(() => ({ ...ConfigQuery.detail.options() })),
  },

  // biome-ignore format: this looks nicer
  isYomitanInstalled: {
    options: () => queryOptions({ ...keyStore["settings:config"].isYomitanInstalled, placeholderData: false, }),
    use: () => useQuery(() => ({ ...ConfigQuery.isYomitanInstalled.options(), })),
  },
} satisfies Query;

const ConfigMutation = {
  // biome-ignore format: this looks nicer
  setConfig: () =>
    useMutation(() => {
      const qc = useQueryClient();
      return {
        mutationFn: (config: Partial<Config>) => ipcRenderer.invoke("settings:setSettings", config),
        onSuccess: async () => await Promise.all([
            qc.invalidateQueries({ queryKey: keyStore["settings:config"].detail.queryKey, }),
          ]),
      };
    }),

  // biome-ignore format: this looks nicer
  installYomitan: () =>
    useMutation(() => {
      const qc = useQueryClient();
      return {
        mutationFn: () => ipcRenderer.invoke("yomitan:reinstall"),
        onSuccess: async () => await Promise.all([
            qc.invalidateQueries({ queryKey: keyStore["settings:config"].isYomitanInstalled.queryKey, }),
          ]),
      };
    }),
} satisfies Mutation;

export const SettingsQuery = {
  PythonQuery,
  EnvQuery,
  ConfigQuery,
};

export const SettingsMutation = {
  PythonMutation,
  ConfigMutation,
};
