import { Link, Outlet, createFileRoute, redirect, useMatchRoute } from "@tanstack/react-router";
import { Terminal, FileText, Settings } from "lucide-react";
import { tv } from "@heroui/react";
import { WSBusError } from "@repo/shared/ws-bus";
import { Popover } from "@heroui/react";
import { useSessions$ } from "#/hooks/sessions";
import { Suspense } from "react";

const navLink = tv({
  base: [
    "p-3 rounded transition-colors text-foreground/60 cursor-pointer",
    "hover:text-foreground",
    "[&.active]:bg-surface-hover [&.active]:text-foreground",
  ],
  variants: {
    active: {
      active: "bg-surface-hover text-foreground",
    },
  },
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
  return (
    <div className="flex h-screen">
      <aside className="w-16 bg-surface flex flex-col items-center py-4 border-r border-border justify-between">
        <nav className="flex flex-col gap-2">
          <Link to="/" className={navLink()} title="Home">
            <Terminal size={20} />
          </Link>
          <TextHookerSessionListPopover />
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

export function TextHookerSessionListPopover() {
  const matchRoute = useMatchRoute();
  const active = matchRoute({
    to: "/text-hooker/$sessionId",
  });

  return (
    <Popover>
      <Popover.Trigger>
        <button
          className={navLink({
            active: !!active ? "active" : undefined,
          })}
        >
          <FileText size={20} />
        </button>
      </Popover.Trigger>
      <Popover.Content className=" overflow-auto">
        <Popover.Dialog className="flex flex-col gap-4">
          <Popover.Heading className="text-lg">Text Hooker Session</Popover.Heading>
          <Suspense fallback="loading...">
            <TextHookerSessionList />
          </Suspense>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}

export function TextHookerSessionList() {
  const { data: sessions } = useSessions$();
  const reversedSessions = [...sessions].reverse();

  return (
    <div className="flex flex-col gap-2 max-h-[50vh] overflow-auto">
      {reversedSessions.map((session) => (
        <Link
          className="text-surface-foreground-calm hover:text-surface-foreground transition-colors pe-2"
          key={session.id}
          to={`/text-hooker/$sessionId`}
          params={{ sessionId: String(session.id) }}
        >
          {session.name}
        </Link>
      ))}
    </div>
  );
}
