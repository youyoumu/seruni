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

export const zMediaSrc = z.object({
  fileName: z.string(),
  source: z.union([z.literal("storage"), z.literal("anki")]),
});

export const zSelectionData = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});

export type AnkiHistory = z.infer<typeof zAnkiHistory>;
export type Media = z.infer<typeof zMedia>;
export type MediaSrc = z.infer<typeof zMediaSrc>;
export type SelectionData = z.infer<typeof zSelectionData>;

export const zMiningIPC = {
  main: z.object({
    "mining:sendReplayBufferStartTime": z.object({
      input: z.tuple([
        z.object({
          time: z.date().optional(),
        }),
      ]),
      output: z.void(),
    }),
    "mining:sendReplayBufferDuration": z.object({
      input: z.tuple([
        z.object({
          duration: z.number(),
        }),
      ]),
      output: z.void(),
    }),
  }),
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
    "mining:getReplayBufferStartTime": z.object({
      input: z.tuple([]),
      output: z.object({
        time: z.date().optional(),
      }),
    }),
    "mining:getReplayBufferDuration": z.object({
      input: z.tuple([]),
      output: z.object({
        duration: z.number(),
      }),
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
    "mining:cropPicture": z.object({
      input: z.tuple([z.number(), zMediaSrc, zSelectionData]),
      output: z.void(),
    }),
  }),
};
