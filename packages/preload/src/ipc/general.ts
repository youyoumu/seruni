import z from "zod";
import { simple } from "./_util";

export const generalIPC = {
  renderer: z.object({
    "general:ready": simple,
  }),
};
