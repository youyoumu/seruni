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
      ...queryKey["settings:env"].detail,
      queryFn: () => {
        return ipcRenderer.invoke("settings:getEnv");
      },
    }));
  });
