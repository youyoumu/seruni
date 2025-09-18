import z from "zod";
import { simple } from "./_util.js";

export const overlayIPC = {
  renderer: z.object({
    "overlay:open": simple,
    "overlay:minimize": simple,
  }),
};
