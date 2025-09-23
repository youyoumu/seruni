export const windows = {
  create(createData?: object, callback?: (window: object) => void) {},
  get(windowId: number, callback: (window: object) => void) {},
  update(
    windowId: number,
    updateInfo: object,
    callback?: (window: object) => void,
  ) {},
};
