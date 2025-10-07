import z from "zod";
import { vnOverlaySettings } from "./_shared";
import { simple } from "./_util";

export const vnOverlayIPC = {
  main: z.object({
    "vnOverlay:setSettings": z.object({
      input: z.tuple([vnOverlaySettings]),
      output: z.void(),
    }),
    "vnOverlay:sendText": z.object({
      input: z.tuple([
        z.object({
          time: z.date(),
          text: z.string(),
          uuid: z.string(),
        }),
      ]),
      output: z.void(),
    }),
  }),
  renderer: z.object({
    "vnOverlay:open": simple,
    "vnOverlay:minimize": simple,
  }),
};
