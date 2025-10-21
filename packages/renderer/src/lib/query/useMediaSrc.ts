import { useQuery } from "@tanstack/solid-query";
import { noUndefinedArray, queryKey } from "./_util";

export const mediaSrcQuery = ({ noteId }: { noteId: number }) => {
  const query = useQuery(() => ({
    ...queryKey.mediaSrc.one(noteId),
    queryFn: async () => {
      return await ipcRenderer.invoke("mining:getNoteMedia", { noteId });
    },
    initialData: [],
  }));

  return noUndefinedArray(query);
};
