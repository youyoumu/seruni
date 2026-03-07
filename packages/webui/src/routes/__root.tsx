import type { Services } from "#/hooks/services";
import { SocketError } from "@repo/shared/krissan/client";
import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Outlet, redirect } from "@tanstack/react-router";
// import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

const RootLayout = () => (
  <>
    <Outlet />
    {/* <TanStackRouterDevtools /> */}
  </>
);

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
  services: Services;
}>()({
  component: RootLayout,
  async loader({ context, location }) {
    if (location.pathname === "/offline") return;
    const { api } = context.services;
    try {
      const _a = await api.request["health/check"]();
    } catch (e) {
      if (e instanceof SocketError && e.type === SocketError.ConnectionClosed) {
        throw redirect({
          to: "/offline",
          search: { redirect: location.pathname },
        });
      } else {
        console.log("DEBUG[1753]: e=", e);
        throw new Error("checkHealth fail", { cause: e });
      }
    }
  },
});
