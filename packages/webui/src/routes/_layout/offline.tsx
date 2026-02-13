import { useOnline, useServices } from "#/hooks/api";
import { createFileRoute, useLocation } from "@tanstack/react-router";
import { ShellIcon } from "lucide-react";
import { useEffect, useRef } from "react";

type Search = {
  redirect: string;
};
export const Route = createFileRoute("/_layout/offline")({
  component: RouteComponent,
  //TODO: use zod
  validateSearch: (search): Search => {
    return {
      redirect: search.redirect as string,
    };
  },
});

function RouteComponent() {
  /* //TODO: pretty loading */
  const { redirect } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { ws } = useServices();
  const location = useLocation();
  const timeoutId = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const handler = () => {
      ws.removeEventListener("open", handler);
      if (timeoutId.current) clearTimeout(timeoutId.current);
      timeoutId.current = setTimeout(() => {
        navigate({
          to: redirect,
          search: { redirect: location.pathname },
        });
      }, 1000);
    };
    ws.addEventListener("open", handler);
    return () => {
      ws.removeEventListener("open", handler);
    };
  }, [navigate, ws, location, redirect]);

  return (
    <div className="flex h-screen items-center justify-center">
      <ShellIcon className="size-64 animate-spin  text-surface-foreground-faint [animation-direction:reverse]"></ShellIcon>
    </div>
  );
}
