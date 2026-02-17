import pino from "pino";
import pretty from "pino-pretty";

export function createLogger(
  options: {
    level?: pino.Level;
  } = {},
) {
  return pino(
    {
      level: options.level ?? "trace",
    },
    pretty({
      ignore: "pid,hostname",
      translateTime: "SYS:HH:MM:ss",
    }),
  );
}
