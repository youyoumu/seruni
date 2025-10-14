import z from "zod";

export const zSimple = z.object({
  input: z.tuple([]),
  output: z.void(),
});
