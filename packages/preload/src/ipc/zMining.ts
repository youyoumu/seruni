import z from "zod";
import { zAnkiNote } from "./_shared";

export const zAnkiConnectUrlPath = z.literal("/anki/connect/");
export const zAnkiCollectionMediaUrlPath = z.literal("/anki/collection.media/");
export const zStorageUrlPath = z.literal("/storage/");

export const zParsedAnkiNote = z.object({
  id: z.number(),
  expression: z.string(),
  picture: z.string(),
  picturePath: z.string().optional(),
  sentenceAudio: z.string(),
  sentenceAudioPath: z.string().optional(),
  nsfw: z.boolean(),
  raw: zAnkiNote,
});

export const zAnkiHistory = z.array(zParsedAnkiNote);

export const zNoteMedia = z.array(
  z.object({
    fileName: z.string(),
    filePath: z.string(),
    type: z.union([z.literal("picture"), z.literal("sentenceAudio")]),
    vadData: z
      .array(z.object({ start: z.number(), end: z.number() }))
      .nullable(),
  }),
);

export const zNoteMediaSrc = z.object({
  fileName: z.string(),
  source: z.union([z.literal("storage"), z.literal("anki")]),
});

export const zSelectionData = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});

export const zTrimData = z.object({
  start: z.number(),
  end: z.number(),
});

export const zUpdateNoteData = z.object({
  noteId: z.number(),
  picture: z.string().optional(),
  sentenceAudio: z.string().optional(),
  nsfw: z.boolean().optional(),
});

export const zConfirmDuplicateNoteData = z.object({
  uuid: z.string(),
  action: z.union([z.literal("create"), z.literal("update")]),
  params: z.object({ noteId: z.number() }).optional(),
});

export type ParsedAnkiNote = z.infer<typeof zParsedAnkiNote>;
export type AnkiHistory = z.infer<typeof zAnkiHistory>;
export type NoteMedia = z.infer<typeof zNoteMedia>;
export type NoteMediaSrc = z.infer<typeof zNoteMediaSrc>;
export type SelectionData = z.infer<typeof zSelectionData>;
export type TrimData = z.infer<typeof zTrimData>;
export type UpdateNoteData = z.infer<typeof zUpdateNoteData>;
export type ConfirmDuplicateNoteData = z.infer<
  typeof zConfirmDuplicateNoteData
>;

export const zMiningIPC = {
  main: z.object({
    "mining:sendReplayBufferStartTime": z.object({
      input: z.tuple([z.object({ time: z.date().optional() })]),
      output: z.void(),
    }),
    "mining:sendReplayBufferDuration": z.object({
      input: z.tuple([z.object({ duration: z.number() })]),
      output: z.void(),
    }),
    "mining:duplicateNoteConfirmation": z.object({
      input: z.tuple([
        z.object({ uuid: z.string(), noteIds: z.array(z.number()) }),
      ]),
      output: z.void(),
    }),
  }),
  renderer: z.object({
    "mining:getTextHistory": z.object({
      input: z.tuple([]),
      output: z.array(
        z.object({ uuid: z.string(), text: z.string(), time: z.date() }),
      ),
    }),
    "mining:getReplayBufferStartTime": z.object({
      input: z.tuple([]),
      output: z.object({ time: z.date().optional() }),
    }),
    "mining:getReplayBufferDuration": z.object({
      input: z.tuple([]),
      output: z.object({ duration: z.number() }),
    }),
    "mining:getSourceScreenshot": z.object({
      input: z.tuple([]),
      output: z.object({ image: z.string().nullable() }),
    }),
    "mining:getAnkiHistory": z.object({
      input: z.tuple([]),
      output: zAnkiHistory,
    }),
    "mining:getNoteMedia": z.object({
      input: z.tuple([z.object({ noteId: z.number() })]),
      output: zNoteMedia,
    }),
    "mining:deleteNoteMedia": z.object({
      input: z.tuple([z.object({ fileName: z.string() })]),
      output: z.object({
        noteIds: z.array(z.number()),
      }),
    }),
    "mining:cropPicture": z.object({
      input: z.tuple([z.number(), zNoteMediaSrc, zSelectionData]),
      output: z.void(),
    }),
    "mining:trimAudio": z.object({
      input: z.tuple([z.number(), zNoteMediaSrc, zTrimData]),
      output: z.void(),
    }),
    "mining:updateNote": z.object({
      input: z.tuple([zUpdateNoteData]),
      output: z.void(),
    }),
    "mining:confirmDuplicateNote": z.object({
      input: z.tuple([zConfirmDuplicateNoteData]),
      output: z.void(),
    }),
    "mining:getNoteInfo": z.object({
      input: z.tuple([z.object({ noteId: z.number() })]),
      output: zParsedAnkiNote,
    }),
  }),
};
