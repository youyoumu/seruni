import z from "zod";
import { zSimple } from "./_util";

export const zClientStatus = z.union([
  z.literal("connected"),
  z.literal("disconnected"),
  z.literal("connecting"),
]);

export type ClientStatus = z.infer<typeof zClientStatus>;

export const zGeneralIPC = {
  renderer: z.object({
    "general:ready": zSimple,
    "general:getClientStatus": z.object({
      input: z.tuple([]),
      output: z.object({
        anki: zClientStatus,
        obs: zClientStatus,
        textractor: zClientStatus,
      }),
    }),
  }),
};
