import z from "zod";
import { vnOverlaySettings } from "./vnOverlay";

//TODO: share this to main
const configSchema = z.object({
  window: z.object({
    vn_overlay: z.object({
      font: z.string(),
      fontSize: z.number(),
      fontWeight: z.number(),
      windowColor: z.string(),
      backgroundColor: z.string(),
      textColor: z.string(),
    }),
  }),
});

export const settingsIPC = {
  renderer: z.object({
    "settings:setVnOverlaySettings": z.object({
      input: z.tuple([vnOverlaySettings]),
      output: z.void(),
    }),
    "settings:getConfig": z.object({
      input: z.tuple([]),
      output: configSchema,
    }),
  }),
};
