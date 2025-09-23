import z from "zod";
import { simple } from "./_util.js";

export const yomitanIPC = {
  renderer: z.object({
    "yomitan:open": simple,
    "yomitan:minimize": simple,
    "yomitan:reinstall": simple,
  }),
};
