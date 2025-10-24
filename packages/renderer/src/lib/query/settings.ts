import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/solid-query";
import { untrack } from "solid-js";
import { keyStore, type RemovePrototype } from "./_util";

class PythonQuery {
  //biome-ignore format: this looks nicer
  static isInstalled = {
    options: () => queryOptions({ ...keyStore["settings:python"].isInstalled, placeholderData: false, }),
    use: () => useQuery(() => ({ ...PythonQuery.isInstalled.options(), })),
  };

  //biome-ignore format: this looks nicer
  static healthcheck = {
    options: () => queryOptions({ ...keyStore["settings:python"].healthcheck, placeholderData: {}, }),
    use: () =>
      useQuery(() => {
        const installed = PythonQuery.isInstalled.use();
        installed.isStale;
        return { ...PythonQuery.healthcheck.options(), enabled: untrack(() => installed.data === true), };
      }),
  };

  //biome-ignore format: this looks nicer
  static pipList = {
    options: () => queryOptions({ ...keyStore["settings:python"].pipList, placeholderData: [], }),
    use: () =>
      useQuery(() => {
        const installed = PythonQuery.isInstalled.use();
        installed.isStale;
        return { ...PythonQuery.pipList.options(), enabled: untrack(() => installed.data === true), };
      }),
  };

  //biome-ignore format: this looks nicer
  static isUvInstalled = {
    use: () =>
      useQuery(() => {
        const installed = PythonQuery.isInstalled.use();
        installed.isStale;
        const { queryKey, queryFn, placeholderData } = PythonQuery.pipList.options();
        return { queryKey, queryFn, placeholderData,
          select: (data) => data?.some((p) => p.name === "uv"),
          enabled: untrack(() => installed.data === true),
        };
      }),
  };

  //biome-ignore format: this looks nicer
  static venvPipList = {
    options: () => queryOptions({ ...keyStore["settings:python"].venvPipList, placeholderData: [], }),
    use: () =>
      useQuery(() => {
        const uv = PythonQuery.isUvInstalled.use();
        uv.isStale;
        return { ...PythonQuery.venvPipList.options(), enabled: untrack(() => uv.data === true), };
      }),
  };

  //biome-ignore format: this looks nicer
  static venvHealthcheck = {
    options: () => queryOptions({ ...keyStore["settings:python"].venvHealthcheck, placeholderData: {}, }),
    use: () =>
      useQuery(() => {
        const uv = PythonQuery.isUvInstalled.use();
        uv.isStale;
        return { ...PythonQuery.venvHealthcheck.options(), enabled: untrack(() => uv.data === true), };
      }),
  };

  //biome-ignore format: this looks nicer
  static venvDependenciesInstalled = {
    use: () =>
      useQuery(() => {
        const { queryKey, queryFn, placeholderData } = PythonQuery.venvHealthcheck.options();
        const uv = PythonQuery.isUvInstalled.use();
        uv.isStale;
        return { queryKey, queryFn, placeholderData,
          select: (data) => data?.ok === true,
          enabled: untrack(() => uv.data === true),
        };
      }),
  };
}

class PythonMutation {
  //biome-ignore format: this looks nicer
  static installPython = () =>
    useMutation(() => {
      const qc = useQueryClient();
      return {
        mutationFn: () => ipcRenderer.invoke("settings:installPython"),
        onSuccess: () => Promise.all([
            qc.invalidateQueries({ queryKey: keyStore["settings:python"].isInstalled.queryKey, }),
            qc.invalidateQueries({ queryKey: keyStore["settings:python"].healthcheck.queryKey, }),
            qc.invalidateQueries({ queryKey: keyStore["settings:python"].pipList.queryKey, }), ]),
      };
    });

  //biome-ignore format: this looks nicer
  static installUv = () =>
    useMutation(() => {
      const qc = useQueryClient();
      return {
        mutationFn: () => ipcRenderer.invoke("settings:installPythonUv"),
        onSuccess: () => Promise.all([
            qc.invalidateQueries({ queryKey: keyStore["settings:python"].healthcheck.queryKey, }),
            qc.invalidateQueries({ queryKey: keyStore["settings:python"].pipList.queryKey, }),
            qc.invalidateQueries({ queryKey: keyStore["settings:python"].venvHealthcheck.queryKey, }),
            qc.invalidateQueries({ queryKey: keyStore["settings:python"].venvPipList.queryKey, }), ]),
      };
    });

  //biome-ignore format: this looks nicer
  static installDependencies = () =>
    useMutation(() => {
      const qc = useQueryClient();
      return {
        mutationFn: () => ipcRenderer.invoke("settings:installPythonDependencies"),
        onSuccess: () => Promise.all([
            qc.invalidateQueries({ queryKey: keyStore["settings:python"].venvHealthcheck.queryKey, }),
            qc.invalidateQueries({ queryKey: keyStore["settings:python"].venvPipList.queryKey, }), ]),
      };
    });
}

class EnvQuery {
  //biome-ignore format: this looks nicer
  static detail = {
    options: () => queryOptions({ ...keyStore["settings:env"].detail, placeholderData: {} }),
    query: () => useQuery(() => ({ ...EnvQuery.detail.options() })),
  };
}

export const SettingsQuery = {
  EnvQuery: EnvQuery as RemovePrototype<typeof EnvQuery>,
  PythonQuery: PythonQuery as RemovePrototype<typeof PythonQuery>,
};

export const SettingsMutation = {
  PythonMutation: PythonMutation as RemovePrototype<typeof PythonMutation>,
};
