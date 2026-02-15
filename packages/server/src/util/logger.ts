import pino from "pino";
import pretty from "pino-pretty";

export function createLogger() {
  return pino(
    {
      level: "trace",
    },
    pretty({
      ignore: "pid,hostname",
      translateTime: "SYS:HH:MM:ss",
    }),
  );
}
