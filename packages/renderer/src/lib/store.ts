import type { ToastType } from "@ark-ui/solid";
import { makePersisted } from "@solid-primitives/storage";
import { createSignal, type Signal } from "solid-js";
import type { JSX } from "solid-js/jsx-runtime";
import { createStore } from "solid-js/store";

export const [store, setStore] = createStore<{
  general: {
    currentTab: string;
  };
  debug: {
    env: Record<string, string | number | boolean | undefined | null>;
  };
  notifications: {
    id: string | undefined;
    title: JSX.Element;
    description: JSX.Element;
    type: ToastType;
  }[];
  element: {
    statusBar: Signal<HTMLDivElement | undefined>;
  };
}>({
  general: {
    currentTab: "home",
  },
  debug: {
    env: {},
  },
  notifications: [],
  element: {
    statusBar: createSignal<HTMLDivElement>(),
  },
});

export const [localStore, setLocalStore] = makePersisted(
  createStore({
    currentTab: "home",
    consoleTailing: true,
    consoleLogLevel: 10,
    texthookerTimer: 0,
  }),
  { name: "localStore" },
);
