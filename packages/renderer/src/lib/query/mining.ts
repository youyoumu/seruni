import { useQuery } from "@tanstack/solid-query";
import { noUndefinedArray, queryKey } from "./_util";

export const noteMediaQuery = ({ noteId }: { noteId: number }) => {
  const query = useQuery(() => ({
    ...queryKey["mining:noteMedia"].one(noteId),
    queryFn: async () => {
      return await ipcRenderer.invoke("mining:getNoteMedia", { noteId });
    },
  }));

  return noUndefinedArray(query);
};
