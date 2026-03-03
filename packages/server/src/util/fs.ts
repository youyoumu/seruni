import type { Encoding } from "node:crypto";
import type { PathLike } from "node:fs";
import fs from "node:fs/promises";

import { R } from "@praha/byethrow";

import { anyCatch } from "./result";

export const safeAccess = R.fn({
  try: fs.access,
  catch: anyCatch("Error when accessing file"),
});

export const safeReadFile = <T extends Encoding | undefined>(
  path: PathLike,
  ...encoding: T extends undefined ? [] : [T]
) =>
  R.try({
    try: () =>
      fs.readFile(path, encoding[0]) as Promise<T extends undefined ? Buffer<ArrayBuffer> : string>,
    catch: anyCatch("Error when reading file"),
  });

export const safeReadDir = R.fn({
  try: (path: PathLike) => fs.readdir(path),
  catch: anyCatch("Error when reading directory"),
});

export const safeWriteFile = R.fn({
  try: fs.writeFile,
  catch: anyCatch("Error when writing file"),
});

export const safeCp = R.fn({
  try: fs.cp,
  catch: anyCatch("Error when copying file"),
});

export const safeRm = R.fn({
  try: fs.rm,
  catch: anyCatch("Error when removing file"),
});

export const safeMv = (source: string, destination: string) =>
  R.try({
    try: () => {
      return R.pipe(
        safeCp(source, destination),
        R.andThen(() => safeRm(source)),
      );
    },
    catch: anyCatch("Error when moving file"),
  });

export const safeMvBatch = (
  params: {
    source: string;
    destination: string;
  }[],
) =>
  R.try({
    try: async () => {
      for (const { source, destination } of params) {
        const result = await safeCp(source, destination);
        if (R.isFailure(result)) return result.error;
      }
      for (const { source } of params) {
        const result = await safeRm(source);
        if (R.isFailure(result)) return result.error;
      }
    },
    catch: anyCatch("Error when batch moving file"),
  });

export const safeRmdir = R.fn({
  try: fs.rmdir,
  catch: anyCatch("Error when removing directory"),
});

export const safeMkdir = R.fn({
  try: fs.mkdir,
  catch: anyCatch("Error when creating directory"),
});
