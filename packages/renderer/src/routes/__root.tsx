import { SolidQueryDevtools } from "@tanstack/solid-query-devtools";
import { createRootRouteWithContext, Outlet } from "@tanstack/solid-router";
import { TanStackRouterDevtools } from "@tanstack/solid-router-devtools";

export const Route = createRootRouteWithContext()({
  component: RootComponent,
});

function RootComponent() {
  return (
    <>
      <Outlet />
      {import.meta.env.DEV && (
        <Portal mount={document.querySelector("#app") ?? document.body}>
          {/* <TanStackRouterDevtools /> */}
          <SolidQueryDevtools initialIsOpen={true} />
        </Portal>
      )}
    </>
  );
}
