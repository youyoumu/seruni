import z from "zod";
import { zConfig, zVnOverlaySettings } from "./_shared";
import { zSimple } from "./_util";

export const zSettingsIPC = {
  renderer: z.object({
    "settings:setSettings": z.object({
      input: z.tuple([zConfig.partial()]),
      output: z.void(),
    }),
    "settings:setVnOverlaySettings": z.object({
      input: z.tuple([zVnOverlaySettings]),
      output: z.void(),
    }),
    "settings:getConfig": z.object({
      input: z.tuple([]),
      output: zConfig,
    }),
    "settings:getEnv": z.object({
      input: z.tuple([]),
      output: z.record(
        z.string(),
        z.union([z.string(), z.number(), z.boolean()]),
      ),
    }),
    "settings:installPython": zSimple,
    "settings:installPythonUv": zSimple,
    "settings:installPythonDependencies": zSimple,
    "settings:runPython": z.object({
      input: z.tuple([z.array(z.string())]),
      output: z.void(),
    }),
    "settings:inPythonInstalled": z.object({
      input: z.tuple([]),
      output: z.boolean(),
    }),
    "settings:isYomitanInstalled": z.object({
      input: z.tuple([]),
      output: z.boolean(),
    }),
    "settings:pythonPipList": z.object({
      input: z.tuple([]),
      output: z.array(z.record(z.string(), z.unknown())),
    }),
    "settings:pythonUvPipList": z.object({
      input: z.tuple([]),
      output: z.array(z.record(z.string(), z.unknown())),
    }),
    "settings:pythonCheckhealth": z.object({
      input: z.tuple([]),
      output: z.record(z.string(), z.unknown()),
    }),
    "settings:pythonMainCheckhealth": z.object({
      input: z.tuple([]),
      output: z.record(z.string(), z.unknown()),
    }),
  }),
};
