import { queryOptions, useQuery } from "@tanstack/solid-query";
import { reconcile } from "solid-js/store";
import {
  keyStore,
  queryWithPlaceholderData,
  type RemovePrototype,
} from "./_util";

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

//biome-ignore format: this looks nicer
export const MiningQuery = {
  NoteMediaQuery: NoteMediaQuery as RemovePrototype<typeof NoteMediaQuery>,
  SourceScreenshotQuery: SourceScreenshotQuery as RemovePrototype<typeof SourceScreenshotQuery>,
};
