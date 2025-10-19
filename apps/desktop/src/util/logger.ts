import { createWriteStream, type WriteStream } from "node:fs";
import { readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { isBefore, parse, subDays } from "date-fns";
import { Roarr as log_ } from "roarr";
import { bus } from "./bus";

declare global {
  var ROARR: {
    write: (...args: unknown[]) => void;
  };
}

export const log = log_.child<{
  error: unknown;
}>((message) => {
  const error_ =
    message.context.error && message.context.error instanceof Error
      ? {
          message: message.context.error.message,
        }
      : undefined;

  const message_ = {
    ...message,
    context: {
      ...message.context,
      error: error_,
    },
  };

  for (const [key, value] of Object.entries(message_.context)) {
    if (value === undefined)
      delete message_.context[key as keyof typeof message_.context];
  }

  bus.emit("logIPC:send", message_);
  return message_;
});

const logBuffer: string[] = [];
let logFileWriteStream: WriteStream | undefined;

async function cleanupOldLogs(LOG_PATH: string) {
  //TODO: configurable
  const nDaysAgo = subDays(new Date(), 7);
  const files = await readdir(LOG_PATH);
  const filesToDelete: string[] = [];

  files.forEach((file) => {
    if (!file.endsWith(".jsonl")) {
      filesToDelete.push(file);
    } else {
      const dateString = file.replace(".jsonl", "");
      try {
        const date = parse(dateString, "yyyyMMdd_HHmmss_SSS_xxxx", new Date());
        if (isBefore(date, nDaysAgo)) {
          filesToDelete.push(file);
        }
      } catch (e) {
        log.error({ error: e }, "Failed to parse date from log file name");
        filesToDelete.push(file);
      }
    }
  });

  for (const file of filesToDelete) {
    await rm(join(LOG_PATH, file));
  }

  log.debug(`Deleted ${filesToDelete.length} old logs`);
}

const originalWrite = ROARR.write;
ROARR.write = (...args) => {
  originalWrite?.(...args);
  const logs = args[0]?.toString();
  if (logs) logBuffer.push(logs);
};

setInterval(() => {
  if (logBuffer.length && logFileWriteStream) {
    logFileWriteStream.write(logBuffer.join("\n"));
    logBuffer.length = 0;
  }
}, 500);

bus.once("env:ready", ({ LOG_PATH, LOG_FILE_PATH }) => {
  logFileWriteStream = createWriteStream(LOG_FILE_PATH, { flags: "a" });
  cleanupOldLogs(LOG_PATH);
});
