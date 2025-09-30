import z from "zod";

export const logIPC = {
  main: z.object({
    "log:send": z.object({
      input: z.tuple([
        z.object({
          context: z.record(z.string(), z.unknown()),
          message: z.string(),
          sequence: z.string(),
          time: z.number(),
          version: z.string(),
        }),
      ]),
      output: z.void(),
    }),
  }),
};
