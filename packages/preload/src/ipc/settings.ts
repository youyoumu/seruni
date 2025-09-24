import z from "zod";
import { vnOverlaySettings } from "./vnOverlay";

export const settingsIPC = {
  renderer: z.object({
    "settings:setVnOverlaySettings": z.object({
      input: z.tuple([vnOverlaySettings]),
      output: z.void(),
    }),
  }),
};
