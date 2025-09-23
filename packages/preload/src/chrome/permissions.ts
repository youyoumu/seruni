const fakePermissions = {
  origins: [
    "<all_urls>",
    "chrome://favicon/*",
    "file:///*",
    "http://*/*",
    "https://*/*",
  ],
  permissions: [
    "webRequest",
    "webRequestBlocking",

    "storage",
    "clipboardWrite",
    "unlimitedStorage",
    "declarativeNetRequest",
    "scripting",
    "offscreen",
    "contextMenus",
  ],
};

export const permissions = {
  // contains(permissions: object, callback: (result: boolean) => void) {},
  getAll(callback: (permissions: object) => void) {
    callback(fakePermissions);
  },
  // onAdded: {
  //   addListener(callback: (permissions: object) => void) {},
  // },
  // onRemoved: {
  //   addListener(callback: (permissions: object) => void) {},
  // },
  // remove(permissions: object, callback: (removed: boolean) => void) {},
  // request(permissions: object, callback: (granted: boolean) => void) {},
};
