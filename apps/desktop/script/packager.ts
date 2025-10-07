import packager from "@electron/packager";

await packager({
  dir: "./dist",
  out: "./release",
  platform: ["win32", "linux"],
});
