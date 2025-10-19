import { createWriteStream, type WriteStream } from "node:fs";
import { Roarr as log_ } from "roarr";
import { bus } from "./bus";

const logBuffer: string[] = [];
let logFileWriteStream: WriteStream | undefined;

bus.once("env:ready", ({ LOG_FILE_PATH }) => {
  logFileWriteStream = createWriteStream(LOG_FILE_PATH, { flags: "a" });
});

declare global {
  var ROARR: {
    write: (...args: unknown[]) => void;
  };
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
