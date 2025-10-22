import { queryOptions, useQuery } from "@tanstack/solid-query";
import { useOwner } from "../util";
import { noUndefinedArray, queryKey } from "./_util";

export const noteMediaQueryOptions = ({ noteId }: { noteId: number }) => {
  return queryOptions({
    ...queryKey["mining:noteMedia"].one(noteId),
    queryFn: async () => {
      return await ipcRenderer.invoke("mining:getNoteMedia", { noteId });
    },
  });
};

export const useNoteMediaQuery = ({ noteId }: { noteId: number }) => {
  return useOwner(() => {
    const query = useQuery(() => ({
      ...queryKey["mining:noteMedia"].one(noteId),
      queryFn: async () => {
        return await ipcRenderer.invoke("mining:getNoteMedia", { noteId });
      },
    }));
    return noUndefinedArray(query);
  });
};
