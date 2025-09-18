import { Roarr as log_ } from "roarr";
import { logIPC } from "#/ipc/log";

export const log = log_.child<Record<string, string>>((message) => {
  logIPC.send("log:send", message);
  return message;
});
