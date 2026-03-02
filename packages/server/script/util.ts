import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
const require = createRequire(import.meta.url);

export const ROOT_DIR = path.join(import.meta.dirname, "..");
export const RELEASE_DIR = path.join(ROOT_DIR, ".release");
await fs.mkdir(RELEASE_DIR, { recursive: true });
process.chdir(ROOT_DIR);

export function getPackageVersion() {
  const packageJson = require(path.join(ROOT_DIR, "package.json"));
  return packageJson.version;
}
