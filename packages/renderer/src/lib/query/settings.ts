import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/solid-query";
import { untrack } from "solid-js";
import { queryKey } from "./_util";

class PythonQueries {
  //biome-ignore format: this looks nicer
  static isInstalled = {
    options: () => queryOptions({ ...queryKey["settings:python"].isInstalled, placeholderData: false, }),
    query: () => useQuery(() => ({ ...PythonQueries.isInstalled.options(), })),
  };

  //biome-ignore format: this looks nicer
  static healthcheck = {
    options: () => queryOptions({ ...queryKey["settings:python"].healthcheck, placeholderData: {}, }),
    query: () =>
      useQuery(() => {
        const installed = PythonQueries.isInstalled.query();
        installed.isStale;
        return { ...PythonQueries.healthcheck.options(), enabled: untrack(() => installed.data === true), };
      }),
  };

  //biome-ignore format: this looks nicer
  static pipList = {
    options: () => queryOptions({ ...queryKey["settings:python"].pipList, placeholderData: [], }),
    query: () =>
      useQuery(() => {
        const installed = PythonQueries.isInstalled.query();
        installed.isStale;
        return { ...PythonQueries.pipList.options(), enabled: untrack(() => installed.data === true), };
      }),
  };

  //biome-ignore format: this looks nicer
  static isUvInstalled = {
    query: () =>
      useQuery(() => {
        const installed = PythonQueries.isInstalled.query();
        installed.isStale;
        const { queryKey, queryFn, placeholderData } = PythonQueries.pipList.options();
        return { queryKey, queryFn, placeholderData,
          select: (data) => data?.some((p) => p.name === "uv"),
          enabled: untrack(() => installed.data === true),
        };
      }),
  };

  //biome-ignore format: this looks nicer
  static venvPipList = {
    options: () => queryOptions({ ...queryKey["settings:python"].venvPipList, placeholderData: [], }),
    query: () =>
      useQuery(() => {
        const uv = PythonQueries.isUvInstalled.query();
        uv.isStale;
        return { ...PythonQueries.venvPipList.options(), enabled: untrack(() => uv.data === true), };
      }),
  };

  //biome-ignore format: this looks nicer
  static venvHealthcheck = {
    options: () => queryOptions({ ...queryKey["settings:python"].venvHealthcheck, placeholderData: {}, }),
    query: () =>
      useQuery(() => {
        const uv = PythonQueries.isUvInstalled.query();
        uv.isStale;
        return { ...PythonQueries.venvHealthcheck.options(), enabled: untrack(() => uv.data === true), };
      }),
  };

  //biome-ignore format: this looks nicer
  static venvDependenciesInstalled = {
    query: () =>
      useQuery(() => {
        const { queryKey, queryFn, placeholderData } = PythonQueries.venvHealthcheck.options();
        const uv = PythonQueries.isUvInstalled.query();
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
            qc.invalidateQueries({ queryKey: queryKey["settings:python"].isInstalled.queryKey, }),
            qc.invalidateQueries({ queryKey: queryKey["settings:python"].healthcheck.queryKey, }),
            qc.invalidateQueries({ queryKey: queryKey["settings:python"].pipList.queryKey, }), ]),
      };
    });

  //biome-ignore format: this looks nicer
  static installUv = () =>
    useMutation(() => {
      const qc = useQueryClient();
      return {
        mutationFn: () => ipcRenderer.invoke("settings:installPythonUv"),
        onSuccess: () => Promise.all([
            qc.invalidateQueries({ queryKey: queryKey["settings:python"].healthcheck.queryKey, }),
            qc.invalidateQueries({ queryKey: queryKey["settings:python"].pipList.queryKey, }),
            qc.invalidateQueries({ queryKey: queryKey["settings:python"].venvHealthcheck.queryKey, }),
            qc.invalidateQueries({ queryKey: queryKey["settings:python"].venvPipList.queryKey, }), ]),
      };
    });

  //biome-ignore format: this looks nicer
  static installDependencies = () =>
    useMutation(() => {
      const qc = useQueryClient();
      return {
        mutationFn: () => ipcRenderer.invoke("settings:installPythonDependencies"),
        onSuccess: () => Promise.all([
            qc.invalidateQueries({ queryKey: queryKey["settings:python"].venvHealthcheck.queryKey, }),
            qc.invalidateQueries({ queryKey: queryKey["settings:python"].venvPipList.queryKey, }), ]),
      };
    });
}

export class SettingsQuery {
  //biome-ignore format: this looks nicer
  static env = {
    options: () => queryOptions({ ...queryKey["settings:env"].detail, placeholderData: {}, }),
    query: () => useQuery(() => ({ ...SettingsQuery.env.options(), })),
  };

  static python = PythonQueries;
}

export class SettingsMutation {
  static python = PythonMutation;
}
