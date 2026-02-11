import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Api } from "./hooks/api";

import { routeTree } from "./routeTree.gen";
import { ApiProvider } from "./hooks/api";

const queryClient = new QueryClient();
const api = new Api();

const router = createRouter({
  routeTree,
  context: {
    queryClient,
    api: api.api,
  },
  Wrap: ({ children }) => {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  },
  // TODO: style
  defaultNotFoundComponent: () => {
    return <div>404</div>;
  },
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const rootElement = document.getElementById("root")!;
if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <StrictMode>
      <ApiProvider api={api.api}>
        <RouterProvider router={router} />
      </ApiProvider>
    </StrictMode>,
  );
}
