import fs from "node:fs/promises";

import { ResultAsync } from "neverthrow";

export const safeAccess = ResultAsync.fromThrowable(fs.access, (e) => {
  return e instanceof Error ? e : Error("Error when accessing file");
});

export const safeReadFile = ResultAsync.fromThrowable(fs.readFile, (e) => {
  return e instanceof Error ? e : Error("Error when reading file");
});

export const safeReadDir = ResultAsync.fromThrowable(fs.readdir, (e) => {
  return e instanceof Error ? e : Error("Error when reading directory");
});

export const safeWriteFile = ResultAsync.fromThrowable(fs.writeFile, (e) => {
  return e instanceof Error ? e : Error("Error when writing file");
});

export const safeCp = ResultAsync.fromThrowable(fs.cp, (e) => {
  return e instanceof Error ? e : Error("Error when copying file");
});

export const safeRm = ResultAsync.fromThrowable(fs.rm, (e) => {
  return e instanceof Error ? e : Error("Error when removing file");
});

export const safeRmdir = ResultAsync.fromThrowable(fs.rmdir, (e) => {
  return e instanceof Error ? e : Error("Error when removing directory");
});

export const safeMkdir = ResultAsync.fromThrowable(fs.mkdir, (e) => {
  return e instanceof Error ? e : Error("Error when creating directory");
});
