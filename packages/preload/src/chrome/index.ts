import { action } from "./action";
import { commands } from "./commands";
import { contextMenus } from "./contextMenus";
import { declarativeNetRequest } from "./declarativeNetRequest";
import { extension } from "./extension";
import { i18n } from "./i18n";
import { offscreen } from "./offscreen";
import { omnibox } from "./omnibox";
import { permissions } from "./permissions";
import { runtime } from "./runtime";
import { storage } from "./storage";
import { tabs } from "./tabs";
import { windows } from "./windows";

export const customChrome = {
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
export type CustomChrome = typeof customChrome;
