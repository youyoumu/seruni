import { action } from "./chrome/action";
import { commands } from "./chrome/commands";
import { contextMenus } from "./chrome/contextMenus";
import { declarativeNetRequest } from "./chrome/declarativeNetRequest";
import { extension } from "./chrome/extension";
import { i18n } from "./chrome/i18n";
import { offscreen } from "./chrome/offscreen";
import { omnibox } from "./chrome/omnibox";
import { permissions } from "./chrome/permissions";
import { runtime } from "./chrome/runtime";
import { storage } from "./chrome/storage";
import { tabs } from "./chrome/tabs";
import { windows } from "./chrome/windows";

const customChrome = {
  // action,
  // commands,
  // contextMenus,
  // declarativeNetRequest,
  // extension,
  // i18n,
  // offscreen,
  // omnibox,
  permissions,
  runtime,
  // storage,
  tabs,
  // windows,
};
type CustomChrome = typeof customChrome;

import { contextBridge } from "electron";

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
