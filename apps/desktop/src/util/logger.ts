import { createWriteStream, type WriteStream } from "node:fs";
import { readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { isBefore, parse, subDays } from "date-fns";
import { Roarr as log_ } from "roarr";
import { serializeError } from "serialize-error";
import { bus } from "./bus";

declare global {
  var ROARR: {
    write: (...args: unknown[]) => void;
  };
}

export const log = log_.child<{
  error: unknown;
}>((message) => {
  const serializedError =
    message.context.error !== undefined
      ? serializeError(message.context.error)
      : undefined;

  const message_ = {
    ...message,
    context: {
      ...message.context,
      error: serializedError,
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
    const joined = logBuffer
      .map((line) => {
        // Ensure each log ends with exactly one newline
        return line.endsWith("\n") ? line : `${line}\n`;
      })
      .join("");

    logFileWriteStream.write(joined);
    logBuffer.length = 0;
  }
}, 500);

bus.once("env:ready", ({ LOG_PATH, LOG_FILE_PATH }) => {
  logFileWriteStream = createWriteStream(LOG_FILE_PATH, { flags: "a" });
  cleanupOldLogs(LOG_PATH);
});

process.on("unhandledRejection", (r) =>
  log.error(
    { error: r },
    r instanceof Error ? r.message : "Unhandled rejection",
  ),
);
process.on("uncaughtException", (e) =>
  log.fatal(
    { error: e },
    e instanceof Error ? e.message : "Unhandled exception",
  ),
);
process.on("warning", (w) =>
  log.warn({ name: w.name, message: w.message }, "Warning"),
);

function simulateError() {
  let count = 0;
  setInterval(() => {
    count++;
    const type = count % 3;
    switch (type) {
      case 0:
        // Unhandled rejection
        Promise.reject(new Error("Simulated unhandled rejection"));
        break;
      case 1:
        // Uncaught exception
        throw new Error("Simulated uncaught exception");
      case 2:
        // Process warning
        process.emitWarning("Simulated warning", {
          code: "TEST_WARNING",
          detail: "This is just a test warning",
        });
        break;
    }
  }, 3000);
}

// simulateError();
