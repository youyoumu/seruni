import type { ToastType } from "@ark-ui/solid";
import type { JSX } from "solid-js/jsx-runtime";
import { createStore } from "solid-js/store";

export type ClientStatus = "connected" | "disconnected" | "connecting";
export type Client = {
  status: ClientStatus;
};

export const [store, setStore] = createStore<{
  general: {
    httpServerUrl: string | undefined;
    currentTab: string;
  };
  debug: {
    env: Record<string, string | number | boolean | undefined | null>;
    python: {
      isInstalled: boolean;
      isUvInstalled: boolean;
      isDependencyInstalled: boolean;
      pythonPipList: Array<Record<string, unknown>>;
      pythonUvPipList: Array<Record<string, unknown>>;
      pythonHealthcheck: Record<string, unknown>;
      pythonMainHealthcheck: Record<string, unknown>;
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
    statusBar: {
      height: number;
    };
  };
}>({
  general: {
    currentTab: "home",
    httpServerUrl: undefined,
  },
  debug: {
    env: {},
    python: {
      isInstalled: false,
      isUvInstalled: false,
      isDependencyInstalled: false,
      pythonPipList: [],
      pythonUvPipList: [],
      pythonHealthcheck: {},
      pythonMainHealthcheck: {},
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
    statusBar: {
      height: 0,
    },
  },
});
