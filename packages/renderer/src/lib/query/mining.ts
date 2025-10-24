import { queryOptions, useQuery } from "@tanstack/solid-query";
import { reconcile } from "solid-js/store";
import {
  queryKey,
  queryWithPlaceholderData,
  type RemovePrototype,
} from "./_util";

class NoteMediaQuery {
  //biome-ignore format: this looks nicer
  static one = {
    options: ({ noteId }: { noteId: number }) => queryOptions({ ...queryKey["mining:noteMedia"].one(noteId), placeholderData: [], }),
    use: ({ noteId }: { noteId: number }) => {
      const query = useQuery(() => ({ ...NoteMediaQuery.one.options({ noteId }), reconcile: (old, data) => reconcile(data)(old), }));
      return queryWithPlaceholderData(query, []);
    },
  };
}

export const MiningQuery = {
  NoteMediaQuery: NoteMediaQuery as RemovePrototype<typeof NoteMediaQuery>,
};
