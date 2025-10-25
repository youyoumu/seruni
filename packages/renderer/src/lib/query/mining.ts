import type { NoteMediaSrc, SelectionData } from "@repo/preload/ipc";
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/solid-query";
import { sort } from "fast-sort";
import { untrack } from "solid-js";
import { reconcile } from "solid-js/store";
import {
  keyStore,
  type Mutation,
  type Query,
  queryWithPlaceholderData,
} from "./_util";
import { GeneralQuery } from "./general";

const NoteMediaQuery = {
  // biome-ignore format: this looks nicer
  one: {
    options: ({ noteId }: { noteId: number }) => queryOptions({ ...keyStore["mining:noteMedia"].one(noteId), placeholderData: [], }),
    use: ({ noteId }: { noteId: number }) => {
      const query = useQuery(() => ({ ...NoteMediaQuery.one.options({ noteId }), reconcile: (old, data) => reconcile(data)(old), }));
      return queryWithPlaceholderData(query, []);
    },
  },
} satisfies Query;

const ObsQuery = {
  // biome-ignore format: this looks nicer
  sourceScreenshot: {
    options: () => queryOptions({ ...keyStore["mining:obs"].sourceScreenshot, placeholderData: { image: null }, refetchInterval: 4000, }),
    use: () => useQuery(() => ({ ...ObsQuery.sourceScreenshot.options() })),
  },

  // biome-ignore format: this looks nicer
  replayBufferStartTime: {
    options: () => queryOptions({ ...keyStore["mining:obs"].replayBufferStartTime, placeholderData: { time: undefined }, }),
    use: () => useQuery(() => ({ ...ObsQuery.replayBufferStartTime.options() })),
  },

  // biome-ignore format: this looks nicer
  replayBufferDuration: {
    options: () => queryOptions({ ...keyStore["mining:obs"].replayBufferDuration, placeholderData: { duration: 0 }, }),
    use: () => {
      const query = useQuery(() => ({ ...ObsQuery.replayBufferDuration.options(), }));
      return queryWithPlaceholderData(query, { duration: 0 });
    },
  },
} satisfies Query;

const SessionQuery = {
  // biome-ignore format: this looks nicer
  textHistory: {
    options: () => queryOptions({ ...keyStore["mining:session"].textHistory, placeholderData: [], reconcile: (old, data) => reconcile(data)(old), }),
    use: () => {
      const query = useQuery(() => ({ ...SessionQuery.textHistory.options(), }));
      return queryWithPlaceholderData(query, []);
    },
  },
} satisfies Query;

const AnkiHistoryQuery = {
  // biome-ignore format: this looks nicer
  data: {
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
        return { ...AnkiHistoryQuery.data.options(), enabled: () => untrack(() => clientStatus.data.anki === "connected"), };
      });
      return queryWithPlaceholderData(query, []);
    },
  },
} satisfies Query;

const AnkiMutation = {
  // biome-ignore format: this looks nicer
  cropPicture: () =>
    useMutation(() => {
      const qc = useQueryClient();
      return {
        mutationFn: async (payload: {
          noteId: number;
          mediaSrc: NoteMediaSrc;
          selectionData: SelectionData;
        }) => {
          await ipcRenderer.invoke(
            "mining:cropPicture",
            payload.noteId,
            payload.mediaSrc,
            payload.selectionData,
          );
          return { noteId: payload.noteId };
        },
        onSuccess: async (data) => {
          await Promise.all([
            qc.invalidateQueries({ queryKey: keyStore["mining:noteMedia"].one(data.noteId).queryKey, }),
          ]);
        },
      };
    }),
} satisfies Mutation;

export const MiningQuery = {
  NoteMediaQuery,
  ObsQuery,
  SessionQuery,
  AnkiHistoryQuery,
};

export const MiningMutation = {
  AnkiMutation,
};
