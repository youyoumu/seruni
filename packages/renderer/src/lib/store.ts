import type { ToastType } from "@ark-ui/solid";
import type { JSX } from "solid-js/jsx-runtime";
import { createStore } from "solid-js/store";

export type ClientStatus = "connected" | "disconnected" | "connecting";
export type Client = {
  status: ClientStatus;
};

export const [store, setStore] = createStore<{
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
}>({
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
});
