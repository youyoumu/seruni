import z from "zod";

export const zAnkiConnectUrlPath = z.literal("/anki/connect/");
export const zAnkiCollectionMediaUrlPath = z.literal("/anki/collection.media/");
export const zStorageUrlPath = z.literal("/storage/");

export const zAnkiHistory = z.array(
  z.object({
    id: z.number(),
    expression: z.string(),
    picture: z.string(),
    sentenceAudio: z.string(),
    nsfw: z.boolean(),
  }),
);

export const zMedia = z.array(
  z.object({
    fileName: z.string(),
    type: z.union([z.literal("picture"), z.literal("sentenceAudio")]),
    vadData: z
      .array(
        z.object({
          start: z.number(),
          end: z.number(),
        }),
      )
      .nullable(),
  }),
);

export const zSelectionData = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});

export type AnkiHistory = z.infer<typeof zAnkiHistory>;
export type Media = z.infer<typeof zMedia>;
export type SelectionData = z.infer<typeof zSelectionData>;

export const zMiningIPC = {
  renderer: z.object({
    "mining:setTextUuid": z.object({
      input: z.tuple([
        z.object({
          uuid: z.string(),
        }),
      ]),
      output: z.object({
        uuid: z.string(),
      }),
    }),
    "mining:getTextHistory": z.object({
      input: z.tuple([]),
      output: z.array(
        z.object({
          uuid: z.string(),
          text: z.string(),
          time: z.date(),
        }),
      ),
    }),
    "mining:getSourceScreenshot": z.object({
      input: z.tuple([]),
      output: z.object({
        image: z.string().nullable(),
      }),
    }),
    "mining:getAnkiHistory": z.object({
      input: z.tuple([]),
      output: z.object({
        success: z.boolean(),
        data: zAnkiHistory,
      }),
    }),
    "mining:toggleNoteNsfw": z.object({
      input: z.tuple([
        z.object({
          noteId: z.number(),
          checked: z.boolean(),
        }),
      ]),
      output: z.boolean(),
    }),
    "mining:getNoteMedia": z.object({
      input: z.tuple([
        z.object({
          noteId: z.number(),
        }),
      ]),
      output: zMedia,
    }),
  }),
};
