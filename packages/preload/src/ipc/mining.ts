import z from "zod";

export const zAnkiCollectionMediaUrlPath = z.literal("/anki/collection.media/");

export const zAnkiHistory = z.array(
  z.object({
    id: z.number(),
    word: z.string(),
    picturePath: z.string(),
    sentenceAudioPath: z.string(),
  }),
);

export type AnkiHistory = z.infer<typeof zAnkiHistory>;

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
    "mining:getSourceScreenshot": z.object({
      input: z.tuple([]),
      output: z.object({
        image: z.string().nullable(),
      }),
    }),
    "mining:getAnkiHistory": z.object({
      input: z.tuple([]),
      output: z.object({
        data: zAnkiHistory,
      }),
    }),
    "mining:getAnkiMediaUrl": z.object({
      input: z.tuple([]),
      output: z.object({
        url: z.string(),
      }),
    }),
  }),
};
