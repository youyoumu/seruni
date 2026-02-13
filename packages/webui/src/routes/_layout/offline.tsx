import { useOnline } from "#/hooks/api";
import { createFileRoute } from "@tanstack/react-router";
import { ShellIcon } from "lucide-react";
import { useEffect } from "react";

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
  const online = useOnline();
  const { redirect } = Route.useSearch();
  const navigate = Route.useNavigate();

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    if (online) {
      timeoutId = setTimeout(() => {
        //@ts-expect-error dynamic link
        navigate({
          to: redirect,
        });
      }, 1000);
    }
    return () => {
      clearTimeout(timeoutId);
    };
  }, [online, navigate, redirect]);

  return (
    <div className="flex h-screen items-center justify-center">
      <ShellIcon className="size-64 animate-spin  text-surface-foreground-faint [animation-direction:reverse]"></ShellIcon>
    </div>
  );
}
