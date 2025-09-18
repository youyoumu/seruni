// @ts-nocheck
if (!globalThis.chrome) {
  globalThis.chrome = {};
}

if (!chrome.permissions) {
  chrome.permissions = {};
}

chrome.permissions.getAll = (callback) => {
  // Fake response
  const fakePermissions = {
    origins: [
      "<all_urls>",
      "chrome://favicon/*",
      "file:///*",
      "http://*/*",
      "https://*/*",
    ],
    permissions: [
      "clipboardWrite",
      "storage",
      "unlimitedStorage",
      "webRequest",
      "webRequestBlocking",
    ],
  };
  // Simulate async callback like real API
  setTimeout(() => callback(fakePermissions), 0);
};
