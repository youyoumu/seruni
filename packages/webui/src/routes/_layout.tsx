import { Link, Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { Terminal, FileText, Settings } from "lucide-react";
import { tv } from "@heroui/react";
import { WSBusError } from "@repo/shared/ws-bus";

const navLink = tv({
  base: [
    "p-3 rounded transition-colors text-foreground/60",
    "hover:text-foreground",
    "[&.active]:bg-surface-hover [&.active]:text-foreground",
    "aria-disabled:text-foreground/20",
  ],
});

export const Route = createFileRoute("/_layout")({
  component: LayoutComponent,
  async loader({ context, location }) {
    if (location.pathname === "/offline") return;
    const { api } = context;
    let lastSessionId: number | undefined;
    try {
      await api.request.checkHealth();
      const sessions = await api.request.sessions();
      lastSessionId = sessions[sessions.length - 1].id;
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
    return { lastSessionId };
  },
});

function LayoutComponent() {
  const loaderData = Route.useLoaderData();
  const lastSessionId = loaderData?.lastSessionId;

  return (
    <div className="flex h-screen bg-surface-faint text-foreground">
      <aside className="w-16 bg-surface flex flex-col items-center py-4 border-r border-border justify-between">
        <nav className="flex flex-col gap-2">
          <Link to="/" className={navLink()} title="Home">
            <Terminal size={20} />
          </Link>
          <Link
            disabled={typeof lastSessionId !== "number"}
            to="/text-hooker/$sessionId"
            className={navLink()}
            title="Text Hooker"
            //TODO: infer to number
            params={{ sessionId: lastSessionId?.toString() ?? "" }}
          >
            <FileText size={20} />
          </Link>
        </nav>
        <div className="flex flex-col gap-2">
          <Link to="/settings" className={navLink()} title="Settings">
            <Settings size={20} />
          </Link>
        </div>
      </aside>
      <main className="flex-1 flex flex-col overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
