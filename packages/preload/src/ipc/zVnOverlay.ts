import z from "zod";
import { zVnOverlaySettings } from "./_shared";
import { zSimple } from "./_util";

export const zVnOverlayIPC = {
  main: z.object({
    "vnOverlay:setSettings": z.object({
      input: z.tuple([zVnOverlaySettings]),
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
    "vnOverlay:open": zSimple,
    "vnOverlay:minimize": zSimple,
  }),
};
