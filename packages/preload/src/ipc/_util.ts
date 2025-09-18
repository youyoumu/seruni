import z from "zod";

export const simple = z.object({
  input: z.tuple([]),
  output: z.void(),
});
