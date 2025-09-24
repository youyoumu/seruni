import z from "zod";
import { simple } from "./_util.js";

export const vnOverlayIPC = {
  renderer: z.object({
    "vnOverlay:open": simple,
    "vnOverlay:minimize": simple,
  }),
};
