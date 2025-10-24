import {
  zAnkiCollectionMediaUrlPath,
  zStorageUrlPath,
} from "@repo/preload/ipc";
import { queryOptions, useQuery } from "@tanstack/solid-query";
import { reconcile } from "solid-js/store";
import { queryKey } from "./_util";

export const httpServerUrlQueryOptions = () =>
  queryOptions({
    ...queryKey["general:httpServerUrl"].value,
    initialData: {
      url: window.location.origin,
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
  return useQuery(() => {
    return mediaUrlQueryOptions(fileName(), source());
  });
};

export const clientStatusQueryOptions = () =>
  queryOptions({
    ...queryKey["general:clientStatus"].detail,
    initialData: {
      anki: "disconnected" as const,
      obs: "disconnected" as const,
      textractor: "disconnected" as const,
    },
    refetchInterval: 2000,
    reconcile: (old, data) => reconcile(data)(old),
  });

export const useClientStatusQuery = () => {
  return useQuery(() => ({
    ...clientStatusQueryOptions(),
  }));
};
