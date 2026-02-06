import { Link, Outlet, createFileRoute } from "@tanstack/react-router";
import { Terminal, FileText, Settings } from "lucide-react";
import { tv } from "@heroui/react";

const navLink = tv({
  base: [
    "p-3 rounded transition-colors text-foreground/60",
    "hover:text-foreground",
    "[&.active]:bg-surface-hover [&.active]:text-foreground",
  ],
});

export const Route = createFileRoute("/_layout")({
  component: LayoutComponent,
});

function LayoutComponent() {
  return (
    <div className="flex h-screen bg-background text-foreground">
      <aside className="w-16 bg-surface flex flex-col items-center py-4 border-r border-border justify-between">
        <nav className="flex flex-col gap-2">
          <Link to="/" className={navLink()} title="Home">
            <Terminal size={20} />
          </Link>
          <Link to="/text-hooker" className={navLink()} title="Text Hooker">
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
