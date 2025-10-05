import z from "zod";
import { simple } from "./_util.js";

export const vnOverlaySettings = z.object({
  settings: z.object({
    font: z.string(),
    fontSize: z.number(),
    fontWeight: z.number(),
    windowColor: z.string(),
    backgroundColor: z.string(),
    textColor: z.string(),
  }),
});

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
