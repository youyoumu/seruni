import z from "zod";

export const zVadData = z.array(
  z.object({
    start: z.number(),
    end: z.number(),
  }),
);
export type VadData = z.infer<typeof zVadData>;
