import z from "zod";
import { zSimple } from "./_util";

const zFileChangeData = z.object({
  fileName: z.string(),
});

export const zDevWS = {
  server: z.object({
    "dev:restart": zSimple,
  }),
  client: z.object({
    "dev:fileChange": z.object({
      input: z.tuple([zFileChangeData]),
      output: z.void,
    }),
  }),
};
