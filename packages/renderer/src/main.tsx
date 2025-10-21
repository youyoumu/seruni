import { QueryClient, QueryClientProvider } from "@tanstack/solid-query";
import { createRouter, RouterProvider } from "@tanstack/solid-router";
import { render, Suspense } from "solid-js/web";
import { setStore } from "./lib/store";
import { routeTree } from "./routeTree.gen";

import "./index.css";

type State = Record<string, any>;
class HMR {
  #state = new Map<symbol, State>();

  /**
   * Ensures the state for a given key exists.
   */
  #ensure<T extends State>(key: symbol, initial?: T): T {
    if (!this.#state.has(key)) this.#state.set(key, initial ?? {});
    const state = this.#state.get(key);
    if (!state) throw new Error("State not found");
    return this.#state.get(key) as T;
  }

  /**
   * Create or retrieve a persisted state by symbol.
   */
  createState<T extends State>(key: symbol, initial?: T) {
    const state = this.#ensure<T>(key, initial);

    const get = () => state;
    const set = (next: Partial<T>) => {
      Object.assign(state, next);
    };

    return [get, set] as const;
  }

  /**
   * Clear specific or all HMR states.
   */
  clear(key?: symbol) {
    if (key) this.#state.delete(key);
    else this.#state.clear();
  }
}

declare global {
  var hmr: HMR;
}

if (!window.hmr) window.hmr = new HMR();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,
    },
  },
});

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
    <QueryClientProvider client={queryClient}>
      <Suspense>
        <RouterProvider router={router} />
      </Suspense>
      {/* keep this empty div https://github.com/solidjs/solid/issues/2515 */}
      <div style={{ display: "none" }}></div>
    </QueryClientProvider>
  );
}

ipcRenderer.invoke("general:httpServerUrl").then(({ url }) => {
  setStore("general", "httpServerUrl", url);
  const rootElement = document.getElementById("app");
  if (rootElement) {
    render(() => <App />, rootElement);
  }
});
