import {
  zAnkiCollectionMediaUrlPath,
  zStorageUrlPath,
} from "@repo/preload/ipc";
import { queryOptions, useQuery } from "@tanstack/solid-query";
import { useOwner } from "../util";
import { queryKey } from "./_util";

export const httpServerUrlQueryOptions = () =>
  queryOptions({
    ...queryKey["general:httpServerUrl"].value,
    initialData: {
      url: window.location.origin,
    },
    queryFn: async () => {
      return await ipcRenderer.invoke("general:httpServerUrl");
    },
  });

export const mediaUrlQueryOptions = (
  fileName: string,
  source: "anki" | "storage",
) => {
  const { queryKey, queryFn } = httpServerUrlQueryOptions();
  return queryOptions({
    queryKey,
    queryFn,
    select: ({ url }) => {
      if (source === "anki") {
        return `${url}${zAnkiCollectionMediaUrlPath.value}${fileName}`;
      } else if (source === "storage") {
        return `${url}${zStorageUrlPath.value}${fileName}`;
      }
      return "";
    },
  });
};

export const useMediaUrlQuery = (
  fileName: () => string,
  source: () => "anki" | "storage",
) => {
  return useOwner(() => {
    return useQuery(() => {
      return mediaUrlQueryOptions(fileName(), source());
    });
  });
};
