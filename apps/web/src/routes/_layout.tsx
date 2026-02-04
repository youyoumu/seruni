import { Link, Outlet, useLocation, createFileRoute } from "@tanstack/react-router";
import { Terminal, FileText, Settings } from "lucide-react";

export const Route = createFileRoute("/_layout")({
  component: LayoutComponent,
});

function LayoutComponent() {
  const location = useLocation();

  const navItems = [
    { to: "/", label: "Home", icon: Terminal },
    { to: "/text-hooker", label: "Text Hooker", icon: FileText },
  ] as const;

  const isActive = (to: string) => {
    if (to === "/") return location.pathname === "/";
    return location.pathname.startsWith(to);
  };

  return (
    <div className="flex h-screen bg-background text-foreground">
      <aside className="w-16 bg-surface flex flex-col items-center py-4 border-r border-divider">
        <nav className="flex flex-col gap-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`p-3 rounded transition-colors ${
                  isActive(item.to)
                    ? "bg-default-100 text-foreground"
                    : "text-foreground/60 hover:text-foreground hover:bg-default-100"
                }`}
                title={item.label}
              >
                <Icon size={20} />
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto">
          <button
            className="p-3 text-foreground/60 hover:text-foreground hover:bg-default-100 rounded transition-colors cursor-pointer"
            title="Settings"
          >
            <Settings size={20} />
          </button>
        </div>
      </aside>
      <main className="flex-1 flex flex-col overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
