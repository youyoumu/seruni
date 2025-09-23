export const tabs = {
  captureVisibleTab(
    windowId?: number,
    options?: object,
    callback?: (dataUrl: string) => void,
  ) {},
  connect(tabId: number, connectInfo?: object) {},
  create(createProperties: object, callback?: (tab: object) => void) {},
  get(tabId: number, callback: (tab: object) => void) {},
  getCurrent(callback: (tab?: object) => void) {},
  getZoom(tabId: number, callback: (zoomFactor: number) => void) {},
  MessageSendOptions: {},
  onZoomChange: { addListener(callback: (zoomChangeInfo: object) => void) {} },
  remove(tabIds: number | number[], callback?: () => void) {},
  Tab: {},
  ZoomChangeInfo: {},
};
