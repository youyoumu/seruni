import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { BirdIcon } from "lucide-react";
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
  defaultNotFoundComponent: () => {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-2">
        <BirdIcon className="size-64 text-surface-foreground-faint" strokeWidth={1}></BirdIcon>
        <p className="text-2xl">404</p>
      </div>
    );
  },
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const rootElement = document.getElementById("root");
if (rootElement && !rootElement.innerHTML) {
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
