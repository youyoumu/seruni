import z from "zod";
import { zSimple } from "./_util";

export const zStatus = z.union([
  z.literal("connected"),
  z.literal("disconnected"),
  z.literal("connecting"),
]);

export const zGeneralIPC = {
  renderer: z.object({
    "general:ready": zSimple,
    "general:getClientStatus": z.object({
      input: z.tuple([]),
      output: z.object({
        anki: zStatus,
        obs: zStatus,
        textractor: zStatus,
      }),
    }),
  }),
};
