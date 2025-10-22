import type { ToastType } from "@ark-ui/solid";
import { createSignal, type Signal } from "solid-js";
import type { JSX } from "solid-js/jsx-runtime";
import { createStore } from "solid-js/store";

export type ClientStatus = "connected" | "disconnected" | "connecting";
export type Client = {
  status: ClientStatus;
};

export const [store, setStore] = createStore<{
  general: {
    currentTab: string;
  };
  debug: {
    env: Record<string, string | number | boolean | undefined | null>;
    python: {
      isInstalled: boolean;
      isUvInstalled: boolean;
      isDependencyInstalled: boolean;
      pythonPipList: Array<Record<string, unknown>>;
      pythonVenvPipList: Array<Record<string, unknown>>;
      pythonHealthcheck: Record<string, unknown>;
      pythonVenvHealthcheck: Record<string, unknown>;
    };
  };
  notifications: {
    id: string | undefined;
    title: JSX.Element;
    description: JSX.Element;
    type: ToastType;
  }[];
  client: {
    anki: Client;
    textractor: Client;
    obs: Client;
  };
  element: {
    statusBar: Signal<HTMLDivElement | undefined>;
  };
}>({
  general: {
    currentTab: "home",
  },
  debug: {
    env: {},
    python: {
      isInstalled: false,
      isUvInstalled: false,
      isDependencyInstalled: false,
      pythonPipList: [],
      pythonVenvPipList: [],
      pythonHealthcheck: {},
      pythonVenvHealthcheck: {},
    },
  },
  notifications: [],
  client: {
    anki: {
      status: "disconnected",
    },
    textractor: {
      status: "disconnected",
    },
    obs: {
      status: "disconnected",
    },
  },
  element: {
    statusBar: createSignal<HTMLDivElement>(),
  },
});
