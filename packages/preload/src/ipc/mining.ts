import z from "zod";

export const ankiHistory = z.array(
  z.object({
    id: z.number(),
    word: z.string(),
    picturePath: z.string(),
    sentenceAudioPath: z.string(),
  }),
);

export type AnkiHistory = z.infer<typeof ankiHistory>;

export const miningIPC = {
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
        data: ankiHistory,
      }),
    }),
  }),
};
