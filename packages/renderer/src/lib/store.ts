import type { ToastType } from "@ark-ui/solid";
import type { JSX } from "solid-js/jsx-runtime";
import { createStore } from "solid-js/store";

export const [store, setStore] = createStore<{
  notifications: {
    id: string | undefined;
    title: JSX.Element;
    description: JSX.Element;
    type: ToastType;
  }[];
}>({
  notifications: [],
});
