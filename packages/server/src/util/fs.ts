import fs from "node:fs/promises";

import { R } from "@praha/byethrow";

export const safeAccess = R.fn({
  try: fs.access,
  catch: (e) => (e instanceof Error ? e : Error("Error when accessing file")),
});

export const safeReadFile = R.fn({
  try: fs.readFile,
  catch: (e) => (e instanceof Error ? e : Error("Error when reading file")),
});

export const safeReadDir = R.fn({
  try: fs.readdir,
  catch: (e) => (e instanceof Error ? e : Error("Error when reading directory")),
});

export const safeWriteFile = R.fn({
  try: fs.writeFile,
  catch: (e) => (e instanceof Error ? e : Error("Error when writing file")),
});

export const safeCp = R.fn({
  try: fs.cp,
  catch: (e) => (e instanceof Error ? e : Error("Error when copying file")),
});

export const safeRm = R.fn({
  try: fs.rm,
  catch: (e) => (e instanceof Error ? e : Error("Error when removing file")),
});

export const safeRmdir = R.fn({
  try: fs.rmdir,
  catch: (e) => (e instanceof Error ? e : Error("Error when removing directory")),
});

export const safeMkdir = R.fn({
  try: fs.mkdir,
  catch: (e) => (e instanceof Error ? e : Error("Error when creating directory")),
});
