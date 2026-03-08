import { SideBar } from "#/components/SideBar";
import { StatusBar } from "#/components/StatusBar";
import { useServices } from "#/hooks/services";
import { Button, cn, tv } from "@heroui/react";
import { QueryErrorResetBoundary } from "@tanstack/react-query";
import { Link, Outlet, createFileRoute, useLocation, useMatchRoute } from "@tanstack/react-router";
import { Terminal, FileText, Settings, BugIcon } from "lucide-react";
import { useEffect } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { Group, Panel, usePanelRef } from "react-resizable-panels";

const navLinkTv = tv({
  base: [
    "cursor-pointer rounded p-3 text-foreground/60 transition-colors",
    "hover:text-foreground",
    "[&.active]:bg-surface-hover [&.active]:text-foreground",
  ],
});

export const Route = createFileRoute("/_layout")({
  component: LayoutComponent,
});

function LayoutComponent() {
  const { ws } = useServices();
  const navigate = Route.useNavigate();
  const location = useLocation();

  useEffect(() => {
    return ws.addListener("close", async () => {
      await navigate({
        to: "/offline",
        search: { redirect: location.pathname },
      });
    });
  }, [navigate, ws, location]);

  return (
    <div className="flex h-screen">
      <QueryErrorResetBoundary>
        {({ reset }) => {
          const matchRoute = useMatchRoute();
          const panelRef = usePanelRef();
          return (
            <ErrorBoundary
              onReset={reset}
              fallbackRender={({ resetErrorBoundary, error }) => {
                return (
                  <div className="flex w-full flex-col items-center justify-center gap-2">
                    <BugIcon
                      className="size-64 text-surface-foreground-faint"
                      strokeWidth={1}
                    ></BugIcon>
                    <p className="text-lg">An error occurred</p>
                    <p className="text-danger">{error instanceof Error && error.message}</p>
                    <Button onClick={() => resetErrorBoundary()}>Retry</Button>
                  </div>
                );
              }}
            >
              <aside className="flex w-16 flex-col items-center justify-between border-r border-border bg-surface py-4">
                <nav className="flex flex-col gap-2">
                  <Link to="/" className={navLinkTv()} title="Home">
                    <Terminal size={20} />
                  </Link>
                  <button
                    className={cn(navLinkTv(), {
                      active: matchRoute({ to: "/text-hooker/$sessionId" }),
                    })}
                    onClick={() => {
                      const api = panelRef.current;
                      if (!api) return;
                      const isCollapsed = api.isCollapsed();
                      if (isCollapsed) api.expand();
                      else api.collapse();
                    }}
                  >
                    <FileText size={20} />
                  </button>
                </nav>
                <div className="flex flex-col gap-2">
                  <Link to="/settings" className={navLinkTv()} title="Settings">
                    <Settings size={20} />
                  </Link>
                </div>
              </aside>
              <main className="flex flex-1 flex-col">
                <Group>
                  <Panel panelRef={panelRef} defaultSize="300px" minSize="200px" collapsible>
                    <SideBar panelRef={panelRef.current} />
                  </Panel>
                  <Panel>
                    <div className="relative h-page overflow-auto">
                      <Outlet />
                    </div>
                  </Panel>
                </Group>
                <StatusBar />
              </main>
            </ErrorBoundary>
          );
        }}
      </QueryErrorResetBoundary>
    </div>
  );
}
