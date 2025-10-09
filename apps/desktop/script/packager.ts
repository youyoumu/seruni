import { rm } from "node:fs/promises";
import packager from "@electron/packager";

await rm("./release/seruni-win32-x64", { recursive: true });

await packager({
  dir: "./dist",
  out: "./release",
  platform: ["win32"],
  icon: "./icons/seruni.ico",
});
