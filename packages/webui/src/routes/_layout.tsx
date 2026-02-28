import { TextHookerSessionListPopover } from "#/components/SessionList";
import { StatusBar } from "#/components/StatusBar";
import { useServices } from "#/hooks/services";
import { Button, cn, tv } from "@heroui/react";
import { WSBusError } from "@repo/shared/ws-bus";
import { QueryErrorResetBoundary } from "@tanstack/react-query";
import {
  Link,
  Outlet,
  createFileRoute,
  redirect,
  useLocation,
  useMatchRoute,
} from "@tanstack/react-router";
import { Terminal, FileText, Settings, BugIcon } from "lucide-react";
import { useEffect } from "react";
import { ErrorBoundary } from "react-error-boundary";

const navLinkTv = tv({
  base: [
    "cursor-pointer rounded p-3 text-foreground/60 transition-colors",
    "hover:text-foreground",
    "[&.active]:bg-surface-hover [&.active]:text-foreground",
  ],
});

export const Route = createFileRoute("/_layout")({
  component: LayoutComponent,
  async loader({ context, location }) {
    if (location.pathname === "/offline") return;
    const { api } = context.services;
    try {
      await api.request.checkHealth();
    } catch (e) {
      if (e instanceof WSBusError && e.type === "connectionClosed") {
        throw redirect({
          to: "/offline",
          search: { redirect: location.pathname },
        });
      } else {
        throw new Error("checkHealth fail");
      }
    }
  },
});

function LayoutComponent() {
  const matchRoute = useMatchRoute();
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
        {({ reset }) => (
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
                <TextHookerSessionListPopover
                  slot={{
                    trigger: (
                      <button
                        className={cn(navLinkTv(), {
                          active: matchRoute({ to: "/text-hooker/$sessionId" }),
                        })}
                      >
                        <FileText size={20} />
                      </button>
                    ),
                  }}
                ></TextHookerSessionListPopover>
              </nav>
              <div className="flex flex-col gap-2">
                <Link to="/settings" className={navLinkTv()} title="Settings">
                  <Settings size={20} />
                </Link>
              </div>
            </aside>
            <main className="flex flex-1 flex-col overflow-hidden">
              <Outlet />
              <StatusBar />
            </main>
          </ErrorBoundary>
        )}
      </QueryErrorResetBoundary>
    </div>
  );
}
