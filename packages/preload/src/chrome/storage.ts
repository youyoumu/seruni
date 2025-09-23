export const storage = {
  session: {
    get(
      keys: string | string[] | object | null,
      callback: (items: object) => void,
    ) {},
    remove(keys: string | string[], callback?: () => void) {},
    set(items: object, callback?: () => void) {},
  },
};
