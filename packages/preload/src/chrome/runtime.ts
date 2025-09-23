export const runtime = {
  connectNative(application: string) {},
  getContexts(object: object, callback: (contexts: object[]) => void) {
    callback?.([]);
  },
  openOptionsPage(callback?: () => void) {
    callback?.();
  },
};
