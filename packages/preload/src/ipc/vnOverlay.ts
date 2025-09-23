import z from "zod";
import { simple } from "./_util.js";

export const vnOverlayIPC = {
  renderer: z.object({
    "vn:overlay:open": simple,
    "vn:overlay:minimize": simple,
  }),
};
