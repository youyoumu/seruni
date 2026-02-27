import { useAppForm } from "#/hooks/form";
import {
  useSessions$,
  useActiveSession$,
  useSetActiveSession,
  useCreateNewSession,
  useDeleteSession,
} from "#/hooks/sessions";
import { Popover, Skeleton, cn } from "@heroui/react";
import { Link } from "@tanstack/react-router";
import { CircleIcon, TrashIcon } from "lucide-react";
import { Suspense } from "react";
import z from "zod";

export function TextHookerSessionListPopover(props: {
  slot: {
    trigger: React.ReactNode;
  };
}) {
  return (
    <Popover>
      <Popover.Trigger>{props.slot.trigger}</Popover.Trigger>
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

function TextHookerSessionList() {
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
            onClick={async () => {
              await setActiveSession(session.id);
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
      onSubmit={async (e) => {
        e.preventDefault();
        await form.handleSubmit();
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
      onClick={async () => {
        await deleteSession(sessionId);
      }}
    ></TrashIcon>
  );
}
