import z from "zod";
import { zSimple } from "./_util";

export const zYomitanIPC = {
  renderer: z.object({
    "yomitan:open": zSimple,
    "yomitan:minimize": zSimple,
    "yomitan:reinstall": z.object({
      input: z.tuple([]),
      output: z.boolean(),
    }),
  }),
};
