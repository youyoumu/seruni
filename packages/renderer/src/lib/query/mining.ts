import { queryOptions, useQuery } from "@tanstack/solid-query";
import { reconcile } from "solid-js/store";
import { queryKey, queryWithPlaceholderData } from "./_util";

export const noteMediaQueryOptions = ({ noteId }: { noteId: number }) => {
  return queryOptions({
    ...queryKey["mining:noteMedia"].one(noteId),
    placeholderData: [],
  });
};

export const useNoteMediaQuery = ({ noteId }: { noteId: number }) => {
  const query = useQuery(() => ({
    ...queryKey["mining:noteMedia"].one(noteId),
    reconcile: (old, data) => reconcile(data)(old),
  }));
  return queryWithPlaceholderData(query, []);
};
