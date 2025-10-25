import {
  zAnkiCollectionMediaUrlPath,
  zStorageUrlPath,
} from "@repo/preload/ipc";
import { queryOptions, useQuery } from "@tanstack/solid-query";
import { reconcile } from "solid-js/store";
import { keyStore, type Query, queryWithPlaceholderData } from "./_util";

const HttpServerUrlQuery = {
  // biome-ignore format: this looks nicer
  value: {
    options: () => queryOptions({ ...keyStore["general:httpServerUrl"].value, placeholderData: { url: window.location.origin }, }),
    use: () => useQuery(() => ({ ...HttpServerUrlQuery.value.options() })),
  },

  // biome-ignore format: this looks nicer
  mediaUrl: {
    options: (fileName: string | undefined, source: "anki" | "storage") => {
      return queryOptions({
        ...keyStore["general:httpServerUrl"].value,
        placeholderData: { url: window.location.origin },
        select: ({ url }) => {
          if (fileName === undefined) return undefined;
          switch (source) {
            case "anki": return `${url}${zAnkiCollectionMediaUrlPath.value}${fileName}`;
            case "storage": return `${url}${zStorageUrlPath.value}${fileName}`;
          }
        },
      });
    },
    use: (fileName: () => string | undefined, source: () => "anki" | "storage") => {
      return useQuery(() => ({ ...HttpServerUrlQuery.mediaUrl.options(fileName(), source()), enabled: !!fileName() }));
    },
  },
} satisfies Query;

const ClientStatusQuery = {
  // biome-ignore format: this looks nicer
  detail: {
    placeholderData: {
      anki: "disconnected" as const,
      obs: "disconnected" as const,
      textractor: "disconnected" as const,
    },
    options: () =>
      queryOptions({
        ...keyStore["general:clientStatus"].detail,
        placeholderData: ClientStatusQuery.detail.placeholderData,
        refetchInterval: 1000,
        reconcile: (old, data) => reconcile(data)(old),
      }),
    use: () => {
      const query = useQuery(() => ({ ...ClientStatusQuery.detail.options(), }));
      return queryWithPlaceholderData( query, ClientStatusQuery.detail.placeholderData,);
    },
  },
} satisfies Query;

export const GeneralQuery = {
  HttpServerUrlQuery,
  ClientStatusQuery,
};
