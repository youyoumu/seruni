import z from "zod";
import { configSchema, vnOverlaySettings } from "./_shared";
import { simple } from "./_util";

export const settingsIPC = {
  renderer: z.object({
    "settings:setSettings": z.object({
      input: z.tuple([configSchema.partial()]),
      output: z.void(),
    }),
    "settings:setVnOverlaySettings": z.object({
      input: z.tuple([vnOverlaySettings]),
      output: z.void(),
    }),
    "settings:getConfig": z.object({
      input: z.tuple([]),
      output: configSchema,
    }),
    "settings:getEnv": z.object({
      input: z.tuple([]),
      output: z.record(
        z.string(),
        z.union([z.string(), z.number(), z.boolean()]),
      ),
    }),
    "settings:installPython": simple,
    "settings:runPython": z.object({
      input: z.tuple([z.array(z.string())]),
      output: z.void(),
    }),
  }),
};
