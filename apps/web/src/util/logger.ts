import pino from "pino";
import pretty from "pino-pretty";

export const logger = pino(
  pretty({
    ignore: "pid,hostname",
    translateTime: "SYS:HH:MM:ss",
  }),
);
