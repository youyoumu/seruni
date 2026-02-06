import pino from "pino";
import pretty from "pino-pretty";

export function createLogger() {
  return pino(
    pretty({
      ignore: "pid,hostname",
      translateTime: "SYS:HH:MM:ss",
    }),
  );
}
