import { fork } from "node:child_process";
import { createReadStream, createWriteStream } from "node:fs";
import { readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { createGzip } from "node:zlib";
import { isBefore, parse, subDays } from "date-fns";
import { serializeError } from "serialize-error";
import { env } from "#/env";
import { bus } from "./bus";

process.env.ROARR_LOG = "true";
const logBuffer: string[] = [];
const logFileWriteStream = createWriteStream(env.LOG_FILE_PATH, { flags: "a" });
const { Roarr: log_, ROARR } = await import("roarr");
const roarr = fork(env.ROARR_CLI_PATH, ["--output-format", "pretty"], {
  stdio: ["pipe", "inherit", "inherit", "ipc"],
});
ROARR.write = (message) => {
  if (!roarr.stdin) {
    process.stdout.write(`$message\n`);
  } else {
    roarr.stdin.write(`${message}\n`);
  }
  logBuffer.push(message);
};

setInterval(() => {
  if (logBuffer.length) {
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

async function cleanupOldLogs() {
  //TODO: configurable
  const nDaysAgo = subDays(new Date(), 7);
  const files = await readdir(env.LOG_PATH);
  const filesToDelete: string[] = [];
  const filesToGzip: string[] = [];

  for (const file of files) {
    if (file.endsWith(".gz")) continue;
    if (!file.endsWith(".jsonl")) {
      filesToDelete.push(file);
      continue;
    }

    const dateString = file.replace(".jsonl", "");
    try {
      const date = parse(dateString, "yyyyMMdd_HHmmss_SSS_xxxx", new Date());
      if (isBefore(date, nDaysAgo)) {
        filesToDelete.push(file);
      } else {
        filesToGzip.push(file);
      }
    } catch (e) {
      log.error({ error: e }, "Failed to parse date from log file name");
      filesToDelete.push(file);
    }
  }

  // Gzip recent files that aren’t already compressed
  for (const file of filesToGzip) {
    const filePath = join(env.LOG_PATH, file);
    if (filePath === env.LOG_FILE_PATH) continue;
    const destination = `${filePath}.gz`;

    await new Promise<void>((resolve, reject) => {
      createReadStream(filePath)
        .pipe(createGzip({ level: 9 }))
        .pipe(createWriteStream(destination))
        .on("finish", resolve)
        .on("error", reject);
    });

    await rm(filePath);
    log.debug(`Compressed and removed ${file}`);
  }

  for (const file of filesToDelete) {
    await rm(join(env.LOG_PATH, file));
  }

  log.debug(`Deleted ${filesToDelete.length} old logs`);
}
cleanupOldLogs();

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

export const logWithNamespace = (namespace: string) =>
  log.child<{
    namespace: string;
  }>((message) => {
    const message_ = {
      ...message,
      context: {
        ...message.context,
        namespace,
      },
    };
    return message_;
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
