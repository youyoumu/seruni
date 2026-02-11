import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Link, Outlet } from "@tanstack/react-router";
import type { Api } from "#/hooks/api";
// import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

const RootLayout = () => (
  <>
    <Outlet />
    {/* <TanStackRouterDevtools /> */}
  </>
);

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
  api: Api["api"];
}>()({
  component: RootLayout,
});
