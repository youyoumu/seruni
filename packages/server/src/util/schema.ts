import * as z from "zod/mini";

export const zVadData = z.array(
  z.object({
    start: z.number(),
    end: z.number(),
  }),
);
export type VadData = z.infer<typeof zVadData>;

export const zAnkiConnectAddNote = z.looseObject({
  action: z.literal("addNote"),
  params: z.looseObject({
    note: z.looseObject({
      fields: z.record(z.string(), z.string()),
    }),
  }),
});

export const zAnkiConnectCanAddNotes = (expression: string) =>
  z.looseObject({
    action: z.literal("canAddNotes"),
    params: z.looseObject({
      notes: z.array(
        z.looseObject({
          fields: z.looseObject({
            [expression]: z.string(),
          }),
          tags: z.array(z.string()),
          deckName: z.string(),
          modelName: z.string(),
          options: z.looseObject({
            allowDuplicate: z.literal(false),
            duplicateScope: z.string(),
            duplicateScopeOptions: z.looseObject({
              deckName: z.any(),
              checkChildren: z.boolean(),
              checkAllModels: z.boolean(),
            }),
          }),
        }),
      ),
    }),
  });
