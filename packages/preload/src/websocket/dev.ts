import z from "zod";
import { simple } from "./_util";

const fileChangeData = z.object({
  fileName: z.string(),
});

export const devWS = {
  server: z.object({
    "dev:restart": simple,
  }),
  client: z.object({
    "dev:fileChange": z.object({
      input: z.tuple([fileChangeData]),
      output: z.void,
    }),
  }),
};
