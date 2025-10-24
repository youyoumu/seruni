import { queryOptions, useQuery } from "@tanstack/solid-query";
import { sort } from "fast-sort";
import { reconcile } from "solid-js/store";
import {
  keyStore,
  queryWithPlaceholderData,
  type RemovePrototype,
} from "./_util";
import { GeneralQuery } from "./general";

class NoteMediaQuery {
  //biome-ignore format: this looks nicer
  static one = {
    options: ({ noteId }: { noteId: number }) => queryOptions({ ...keyStore["mining:noteMedia"].one(noteId), placeholderData: [], }),
    use: ({ noteId }: { noteId: number }) => {
      const query = useQuery(() => ({ ...NoteMediaQuery.one.options({ noteId }), reconcile: (old, data) => reconcile(data)(old), }));
      return queryWithPlaceholderData(query, []);
    },
  };
}

class SourceScreenshotQuery {
  //biome-ignore format: this looks nicer
  static data = {
    options: () =>
      queryOptions({ ...keyStore["mining:sourceScreenshot"].data,
        placeholderData: { image: null },
        refetchInterval: 4000,
      }),
    use: () => useQuery(() => ({ ...SourceScreenshotQuery.data.options() })),
  };
}

class AnkiHistoryQuery {
  static data = {
    options: () =>
      queryOptions({
        ...keyStore["mining:ankiHistory"].all,
        placeholderData: [],
        refetchInterval: 10000,
        reconcile: (old, data) => reconcile(data)(old),
        select: (data) => sort(data).desc((item) => item.id),
      }),
    use: () => {
      const query = useQuery(() => {
        const clientStatus = GeneralQuery.ClientStatusQuery.detail.use();
        clientStatus.isStale;
        return {
          ...AnkiHistoryQuery.data.options(),
          enabled: () => clientStatus.data.anki === "connected",
        };
      });
      return queryWithPlaceholderData(query, []);
    },
  };
}

//biome-ignore format: this looks nicer
export const MiningQuery = {
  NoteMediaQuery: NoteMediaQuery as RemovePrototype<typeof NoteMediaQuery>,
  SourceScreenshotQuery: SourceScreenshotQuery as RemovePrototype<typeof SourceScreenshotQuery>,
  AnkiHistoryQuery: AnkiHistoryQuery as RemovePrototype<typeof AnkiHistoryQuery>,
};
