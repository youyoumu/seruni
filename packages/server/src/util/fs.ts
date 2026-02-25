import fs from "node:fs/promises";

import { R } from "@praha/byethrow";

import { anyCatch } from "./result";

export const safeAccess = R.fn({
  try: fs.access,
  catch: anyCatch("Error when accessing file"),
});

export const safeReadFile = R.fn({
  try: fs.readFile,
  catch: anyCatch("Error when reading file"),
});

export const safeReadDir = R.fn({
  try: fs.readdir,
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

export const safeRmdir = R.fn({
  try: fs.rmdir,
  catch: anyCatch("Error when removing directory"),
});

export const safeMkdir = R.fn({
  try: fs.mkdir,
  catch: anyCatch("Error when creating directory"),
});
