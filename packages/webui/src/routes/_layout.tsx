import { Link, Outlet, createFileRoute, redirect, useMatchRoute } from "@tanstack/react-router";
import { Terminal, FileText, Settings, TrashIcon, RssIcon } from "lucide-react";
import { cn, tv } from "@heroui/react";
import { WSBusError } from "@repo/shared/ws-bus";
import { Popover } from "@heroui/react";
import { useActiveSession$, useSessions$ } from "#/hooks/sessions";
import { Suspense } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "#/hooks/api";
import { z } from "zod";
import { useAppForm } from "#/hooks/form";

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
      <Popover.Content className=" overflow-auto bg-surface-calm">
        <Popover.Dialog className="flex flex-col gap-4">
          <Popover.Heading className="text-lg">Select Session</Popover.Heading>
          <NewSessionForm />
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
  const { data: activeSession } = useActiveSession$();
  const reversedSessions = [...sessions].reverse();

  return (
    <div className="flex flex-col gap-2 max-h-[50vh] overflow-auto">
      {reversedSessions.map((session) => (
        <div className="flex gap-2 pe-2 items-center">
          <Link
            className={cn(
              "text-surface-foreground-calm hover:text-surface-foreground transition-colors",
              {
                "text-surface-foreground": session.id === activeSession?.id,
              },
            )}
            key={session.id}
            to={`/text-hooker/$sessionId`}
            params={{ sessionId: String(session.id) }}
          >
            {session.name}
          </Link>
          {session.id === activeSession?.id && <RssIcon size={16} />}
          <div className="flex-1"></div>
          <DeleteSessionButton sessionId={session.id} />
        </div>
      ))}
    </div>
  );
}

function NewSessionForm() {
  const api = useApi();
  const queryClient = useQueryClient();
  const { mutateAsync: createNewSession } = useMutation({
    mutationFn: async (name: string) => {
      await api.request.createSession(name);
    },
    onSuccess: () => {
      //TODO: use query key factory
      queryClient.invalidateQueries({
        queryKey: ["sessions"],
      });
    },
  });

  const form = useAppForm({
    defaultValues: {
      name: "",
    },
    validators: {
      onChange: z.object({
        name: z.string().min(1, "can't be empty"),
      }),
    },
    onSubmit: async ({ value }) => {
      await createNewSession(value.name);
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
  const api = useApi();
  const queryClient = useQueryClient();
  const { mutateAsync: deleteSession } = useMutation({
    mutationFn: async (id: number) => {
      await api.request.deleteSession(id);
    },
    onSuccess: () => {
      //TODO: use query key factory
      queryClient.invalidateQueries({
        queryKey: ["sessions"],
      });
    },
  });

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
