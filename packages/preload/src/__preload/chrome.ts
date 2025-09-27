import { contextBridge } from "electron";
import type { CustomChrome } from "#/chrome";
import { customChrome } from "#/chrome";

function executeInMainWorld(customChrome: CustomChrome) {
  // biome-ignore lint: safe any
  function deepMerge(target: any, source: any) {
    for (const key of Object.keys(source)) {
      if (
        key in target &&
        typeof target[key] === "object" &&
        target[key] !== null &&
        typeof source[key] === "object" &&
        source[key] !== null
      ) {
        deepMerge(target[key], source[key]);
      } else if (!(key in target)) {
        target[key] = source[key];
      }
    }
  }

  // detect global object (page vs SW)
  // biome-ignore lint: safe any
  const globalObj: any =
    typeof window !== "undefined"
      ? window
      : typeof self !== "undefined"
        ? self
        : undefined;

  if (!globalObj) {
    throw new Error("No global object found for chrome injection");
  }

  if (!("chrome" in globalObj)) {
    globalObj.chrome = {};
  }

  deepMerge(globalObj.chrome, customChrome);
}

if (process.contextIsolated) {
  contextBridge.executeInMainWorld({
    func: executeInMainWorld,
    args: [customChrome],
  });
}
