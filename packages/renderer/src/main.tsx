import { createRouter, RouterProvider } from "@tanstack/solid-router";
import { render } from "solid-js/web";

import { routeTree } from "./routeTree.gen";
import "./index.css";
import { setStore } from "./lib/store";

const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  scrollRestoration: true,
  defaultPreloadStaleTime: 0,
});

declare module "@tanstack/solid-router" {
  interface Register {
    router: typeof router;
  }
}

function App() {
  return (
    <>
      <RouterProvider router={router} />
    </>
  );
}

ipcRenderer.invoke("settings:getEnv").then((env) => {
  setStore("debug", "env", env);
});

ipcRenderer.invoke("general:httpServerUrl").then(({ url }) => {
  setStore("general", "httpServerUrl", url);
  const rootElement = document.getElementById("app");
  if (rootElement) {
    render(() => <App />, rootElement);
  }
});
