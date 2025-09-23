export const runtime = {
  connectNative(application: string) {},
  ContextType: {},
  getContexts(object: object, callback: (contexts: object[]) => void) {
    callback?.([]);
  },
  InstalledDetails: {},
  Manifest: {},
  ManifestV3: {},
  MessageSender: {},
  openOptionsPage(callback?: () => void) {
    callback?.();
  },
  PlatformInfo: {},
  Port: {},
};
