type ContextClickHandler = (info: unknown, tab?: unknown) => void;

const contextMenuListeners = new Set<ContextClickHandler>();

export const contextMenus = {
  create(properties: unknown, callback?: () => void) {
    if (typeof callback === "function") callback();
    return Math.floor(Math.random() * 100000);
  },
  remove(menuItemId: number | string, callback?: () => void) {
    if (typeof callback === "function") callback();
  },
  onClicked: {
    addListener(listener: ContextClickHandler) {
      contextMenuListeners.add(listener);
    },
    removeListener(listener: ContextClickHandler) {
      contextMenuListeners.delete(listener);
    },
    hasListener(listener: ContextClickHandler) {
      return contextMenuListeners.has(listener);
    },
  },
};

export function _dispatchContextClick(info: unknown, tab?: unknown) {
  for (const listener of contextMenuListeners) {
    listener(info, tab);
  }
}
