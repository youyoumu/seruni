import { useQuery } from "@tanstack/solid-query";
import { queryKey } from "./_util";

export const envQuery = () =>
  useQuery(() => ({
    ...queryKey["settings:env"].detail,
    queryFn: () => {
      return ipcRenderer.invoke("settings:getEnv");
    },
  }));
