import { useServices } from "#/hooks/api";
import { createFileRoute, useLocation } from "@tanstack/react-router";
import { ShellIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import * as z from "zod/mini";

export const Route = createFileRoute("/_layout/offline")({
  component: RouteComponent,
  validateSearch: z.object({
    redirect: z.string(),
    search: z.optional(z.string()),
  }),
});

function RouteComponent() {
  const { redirect, search } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { ws } = useServices();
  const location = useLocation();
  const timeoutId = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const getRedirectPath = () => {
    if (!redirect) return "/";
    if (redirect === "/offline") return "/";
    return redirect;
  };
  const redirectPath = getRedirectPath();

  useEffect(() => {
    const redirectBack = () => {
      if (timeoutId.current) clearTimeout(timeoutId.current);
      timeoutId.current = setTimeout(async () => {
        await navigate({
          to: redirectPath,
          //@ts-expect-error dynamic
          search: search,
        });
      }, 1000);
    };
    if (ws.readyState === WebSocket.OPEN) redirectBack();
    else {
      return ws.addListener("open", redirectBack);
    }
  }, [navigate, ws, location, redirectPath, search]);

  return (
    <div className="flex h-screen items-center justify-center">
      <ShellIcon className="size-64 animate-spin  text-surface-foreground-faint [animation-direction:reverse]"></ShellIcon>
    </div>
  );
}
