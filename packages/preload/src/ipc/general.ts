import z from "zod";
import { simple } from "./_util";

const status = z.union([
  z.literal("connected"),
  z.literal("disconnected"),
  z.literal("connecting"),
]);

export const generalIPC = {
  renderer: z.object({
    "general:ready": simple,
    "general:getClientStatus": z.object({
      input: z.tuple([]),
      output: z.object({
        anki: status,
        obs: status,
        textractor: status,
      }),
    }),
  }),
};
