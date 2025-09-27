import { signal } from "alien-signals";
import { hmr } from "./util/hmr";

export default signal("hello");
export const value2 = signal("value22c");
export const value3 = signal("value33vv");

if (import.meta.hot) {
  await hmr.register(import.meta.url);
  import.meta.hot.accept((mod) => {
    hmr.update(import.meta.url, mod);
  });
}
