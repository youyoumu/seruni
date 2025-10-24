import {
  zAnkiCollectionMediaUrlPath,
  zStorageUrlPath,
} from "@repo/preload/ipc";
import { queryOptions, useQuery } from "@tanstack/solid-query";
import { reconcile } from "solid-js/store";
import {
  queryKey,
  queryWithPlaceholderData,
  type RemovePrototype,
} from "./_util";

class HttpServerUrlQuery {
  static value = {
    options: () =>
      queryOptions({
        ...queryKey["general:httpServerUrl"].value,
        placeholderData: {
          url: window.location.origin,
        },
      }),
    use: () => useQuery(() => ({ ...HttpServerUrlQuery.value.options() })),
  };

  static mediaUrl = {
    options: (fileName: string, source: "anki" | "storage") => {
      return queryOptions({
        ...queryKey["general:httpServerUrl"].value,
        select: ({ url }) => {
          switch (source) {
            case "anki":
              return `${url}${zAnkiCollectionMediaUrlPath.value}${fileName}`;
            case "storage":
              return `${url}${zStorageUrlPath.value}${fileName}`;
          }
        },
      });
    },
    use: (fileName: () => string, source: () => "anki" | "storage") => {
      return useQuery(() => ({
        ...HttpServerUrlQuery.mediaUrl.options(fileName(), source()),
      }));
    },
  };
}

class ClientStatusQuery {
  static detail = {
    placeholderData: {
      anki: "disconnected" as const,
      obs: "disconnected" as const,
      textractor: "disconnected" as const,
    },
    options: () =>
      queryOptions({
        ...queryKey["general:clientStatus"].detail,
        placeholderData: ClientStatusQuery.detail.placeholderData,
        refetchInterval: 1000,
        reconcile: (old, data) => reconcile(data)(old),
      }),
    use: () => {
      const query = useQuery(() => ({ ...ClientStatusQuery.detail.options() }));
      return queryWithPlaceholderData(
        query,
        ClientStatusQuery.detail.placeholderData,
      );
    },
  };
}

export const GeneralQuery = {
  HttpServerUrlQuery: HttpServerUrlQuery as RemovePrototype<
    typeof HttpServerUrlQuery
  >,
  ClientStatusQuery: ClientStatusQuery as RemovePrototype<
    typeof ClientStatusQuery
  >,
};
