import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { StrictMode } from "react";
import ReactDOM from "react-dom/client";

import { Services, OnlineProvider } from "./hooks/api";
import { ServicesProvider } from "./hooks/api";
import { routeTree } from "./routeTree.gen";

const queryClient = new QueryClient();
const services = new Services({ queryClient });

const router = createRouter({
  routeTree,
  context: {
    queryClient,
    services,
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
      <ServicesProvider value={services}>
        <OnlineProvider ws={services.ws}>
          <RouterProvider router={router} />
        </OnlineProvider>
      </ServicesProvider>
    </StrictMode>,
  );
}
