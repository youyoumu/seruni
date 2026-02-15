import { useServices } from "#/hooks/api";
import { useAppForm } from "#/hooks/form";
import {
  useActiveSession$,
  useCreateNewSession,
  useDeleteSession,
  useSessions$,
  useSetActiveSession,
} from "#/hooks/sessions";
import { Button, cn, Skeleton, tv } from "@heroui/react";
import { Popover } from "@heroui/react";
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
import { Terminal, FileText, Settings, TrashIcon, BugIcon, CircleIcon } from "lucide-react";
import { Suspense, useEffect } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { z } from "zod";

const navLink = tv({
  base: [
    "cursor-pointer rounded p-3 text-foreground/60 transition-colors",
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
  const { ws } = useServices();
  const navigate = Route.useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handler = () => {
      ws.removeEventListener("close", handler);
      navigate({
        to: "/offline",
        search: { redirect: location.pathname },
      });
    };
    ws.addEventListener("close", handler);
    return () => {
      ws.removeEventListener("close", handler);
    };
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
            <main className="flex flex-1 flex-col overflow-hidden">
              <Outlet />
            </main>
          </ErrorBoundary>
        )}
      </QueryErrorResetBoundary>
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
            active: active ? "active" : undefined,
          })}
        >
          <FileText size={20} />
        </button>
      </Popover.Trigger>
      <Popover.Content className=" overflow-auto bg-surface-calm">
        <Popover.Dialog className="flex flex-col gap-4">
          <Popover.Heading className="text-lg">Select Session</Popover.Heading>
          <NewSessionForm />
          <Suspense
            fallback={
              <div className="flex flex-col gap-2">
                <Skeleton className="h-3 w-3/5 rounded-lg" />
                <Skeleton className="h-3 w-4/5 rounded-lg" />
                <Skeleton className="h-3 w-5/5 rounded-lg" />
              </div>
            }
          >
            <TextHookerSessionList />
          </Suspense>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}

export function TextHookerSessionList() {
  const { data: sessions } = useSessions$();
  const { data: activeSession } = useActiveSession$();
  const { mutateAsync: setActiveSession } = useSetActiveSession();
  const reversedSessions = [...sessions].reverse();

  //TODO: rename sessions
  return (
    <div className="flex max-h-[50vh] flex-col gap-2 overflow-auto">
      {reversedSessions.map((session) => (
        <div className="flex items-center gap-2 pe-2" key={session.id}>
          <Link
            className={cn(
              "text-surface-foreground-calm transition-colors hover:text-surface-foreground",
              {
                "text-surface-foreground": session.id === activeSession?.id,
              },
            )}
            key={session.id}
            to={`/text-hooker/$sessionId`}
            params={{ sessionId: session.id }}
            onClick={() => {
              setActiveSession(session.id);
            }}
          >
            {session.name}
          </Link>
          {session.id === activeSession?.id && (
            <CircleIcon size={8} fill="var(--color-success)" className="text-success" />
          )}
          <div className="flex-1"></div>
          <DeleteSessionButton sessionId={session.id} />
        </div>
      ))}
    </div>
  );
}

function NewSessionForm() {
  const { mutateAsync: createNewSession } = useCreateNewSession();

  const form = useAppForm({
    defaultValues: {
      name: "",
    },
    validators: {
      onChange: z.object({
        name: z.string().min(1, "Can't be empty"),
      }),
    },
    onSubmit: async ({ value }) => {
      await createNewSession(value.name, {
        onSuccess() {
          form.reset();
        },
      });
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
      className="flex gap-4"
    >
      <form.AppField
        name="name"
        children={(field) => <field.TextFieldSet placeholder="New Session" />}
      />
      <form.AppForm>
        <form.SubmitButton>Create</form.SubmitButton>
      </form.AppForm>
    </form>
  );
}

function DeleteSessionButton({ sessionId }: { sessionId: number }) {
  const { mutateAsync: deleteSession } = useDeleteSession();

  return (
    <TrashIcon
      className="cursor-pointer text-danger"
      size={20}
      onClick={() => {
        deleteSession(sessionId);
      }}
    ></TrashIcon>
  );
}
