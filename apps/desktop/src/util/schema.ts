import z from "zod";

export const zVadData = z.array(
  z.object({
    start: z.number(),
    end: z.number(),
  }),
);
export type VadData = z.infer<typeof zVadData>;

export const zAnkiNote = z.object({
  cards: z.array(z.number()),
  fields: z.record(
    z.string(),
    z.object({ order: z.number(), value: z.string() }),
  ),
  mod: z.number(),
  modelName: z.string(),
  noteId: z.number(),
  profile: z.string(),
  tags: z.array(z.string()),
});

export type AnkiNote = z.infer<typeof zAnkiNote>;

export const zAnkiConnectAddNote = z.object({
  action: z.literal("addNote"),
  params: z.object({
    note: z.object({
      fields: z.record(z.string(), z.string()),
    }),
  }),
});
