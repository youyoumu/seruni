// @ts-nocheck
if (!globalThis.chrome) {
  globalThis.chrome = {};
}

// permissions shim

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
  // Simulate async callback like real API
  setTimeout(() => callback(fakePermissions), 0);
};

// tabs shim

if (!chrome.tabs) {
  chrome.tabs = {};
}

// Fake tab storage
let fakeTabIdCounter = 1;
const fakeTabs = new Map();

// Create a default active tab
const defaultTab = {
  id: fakeTabIdCounter,
  index: 0,
  active: true,
  pinned: false,
  highlighted: true,
  windowId: 1,
  title: "Electron App",
  url: "https://example.com/",
};
fakeTabs.set(fakeTabIdCounter, defaultTab);

chrome.tabs.query = (queryInfo, callback) => {
  // Just return all fake tabs (ignoring queryInfo filtering for now)
  setTimeout(() => callback(Array.from(fakeTabs.values())), 0);
};

chrome.tabs.get = (tabId, callback) => {
  setTimeout(() => callback(fakeTabs.get(tabId) || null), 0);
};

chrome.tabs.create = (createProperties, callback) => {
  const newTab = {
    id: ++fakeTabIdCounter,
    index: fakeTabs.size,
    active: !!createProperties.active,
    pinned: !!createProperties.pinned,
    highlighted: !!createProperties.active,
    windowId: 1,
    title: "New Tab",
    url: createProperties.url || "about:blank",
  };
  fakeTabs.set(newTab.id, newTab);
  setTimeout(() => callback && callback(newTab), 0);
};

chrome.tabs.update = (tabId, updateProperties, callback) => {
  const tab = fakeTabs.get(tabId) || defaultTab;
  if (updateProperties.url) tab.url = updateProperties.url;
  if (updateProperties.active !== undefined)
    tab.active = updateProperties.active;
  setTimeout(() => callback && callback(tab), 0);
};

chrome.tabs.remove = (tabIds, callback) => {
  (Array.isArray(tabIds) ? tabIds : [tabIds]).forEach((id) => {
    fakeTabs.delete(id);
  });
  setTimeout(() => callback && callback(), 0);
};

// Events (stubs, not functional but won’t break extension)
chrome.tabs.onUpdated = { addListener: () => {} };
chrome.tabs.onCreated = { addListener: () => {} };
chrome.tabs.onRemoved = { addListener: () => {} };
chrome.tabs.onActivated = { addListener: () => {} };

// contextMenus shim

if (!chrome.contextMenus) {
  chrome.contextMenus = {};
}

const fakeContextMenus = new Map();
let fakeContextMenuId = 0;

chrome.contextMenus.create = (createProperties, callback) => {
  const id = createProperties.id || `cm_${++fakeContextMenuId}`;
  fakeContextMenus.set(id, {
    ...createProperties,
    id,
  });
  if (callback) setTimeout(() => callback(id), 0);
  return id;
};

chrome.contextMenus.update = (id, updateProperties, callback) => {
  if (fakeContextMenus.has(id)) {
    Object.assign(fakeContextMenus.get(id), updateProperties);
  }
  if (callback) setTimeout(() => callback(), 0);
};

chrome.contextMenus.remove = (id, callback) => {
  fakeContextMenus.delete(id);
  if (callback) setTimeout(() => callback(), 0);
};

chrome.contextMenus.removeAll = (callback) => {
  fakeContextMenus.clear();
  if (callback) setTimeout(() => callback(), 0);
};

// Event stubs (no real UI, but Yomitan won't break)
chrome.contextMenus.onClicked = {
  addListener: () => {},
};
