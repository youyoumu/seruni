import { queryOptions, useQuery } from "@tanstack/solid-query";
import { reconcile } from "solid-js/store";
import { noUndefinedArray, queryKey } from "./_util";

export const noteMediaQueryOptions = ({ noteId }: { noteId: number }) => {
  return queryOptions({
    ...queryKey["mining:noteMedia"].one(noteId),
  });
};

export const useNoteMediaQuery = ({ noteId }: { noteId: number }) => {
  const query = useQuery(() => ({
    ...queryKey["mining:noteMedia"].one(noteId),
    reconcile: (old, data) => reconcile(data)(old),
  }));
  return noUndefinedArray(query);
};
