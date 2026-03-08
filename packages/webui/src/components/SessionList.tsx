import { useAppForm } from "#/hooks/form";
import {
  useSessions$,
  useActiveSession$,
  useSetActiveSession,
  useCreateNewSession,
  useDeleteSession,
} from "#/hooks/sessions";
import { Popover, Skeleton, cn, tv } from "@heroui/react";
import { type Session } from "@repo/shared/db";
import { Link } from "@tanstack/react-router";
import { CircleIcon, CopyIcon, EditIcon, TrashIcon } from "lucide-react";
import { Suspense } from "react";
import * as z from "zod/mini";

const sessionListTv = tv({
  slots: {
    icon: "size-4 min-w-4 cursor-pointer text-surface-foreground-soft transition-colors hover:text-surface-foreground",
    deleteIcon: "size-4 min-w-4 cursor-pointer text-danger transition-opacity hover:opacity-80",
  },
});

//TODO: delete
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

export function TextHookerSessionList() {
  const { data: sessions } = useSessions$();
  const { data: activeSession } = useActiveSession$();
  const { mutateAsync: setActiveSession } = useSetActiveSession();
  const reversedSessions = [...sessions].reverse();
  const { icon } = sessionListTv();

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

          <Link to="/text-hooker/$sessionId/edit" params={{ sessionId: session.id }}>
            <EditIcon className={icon()}></EditIcon>
          </Link>
          <DuplicateSessionButton session={session} />
          {/* <DeleteSessionButton sessionId={session.id} /> */}
        </div>
      ))}
    </div>
  );
}

export function DuplicateSessionButton({ session }: { session: Session }) {
  const { mutateAsync: createNewSession } = useCreateNewSession();
  const { icon } = sessionListTv();

  const handleDuplicate = async () => {
    const name = session.name;
    const match = name.match(/^(.*?)(\d+)$/);
    let newName: string;
    if (match && match[1] !== undefined && match[2] !== undefined) {
      newName = `${match[1]}${parseInt(match[2]) + 1}`;
    } else {
      newName = `${name} 2`;
    }
    await createNewSession(newName);
  };

  return <CopyIcon className={icon()} onClick={handleDuplicate} />;
}

export function NewSessionForm() {
  const { mutateAsync: createNewSession } = useCreateNewSession();

  const form = useAppForm({
    defaultValues: {
      name: "",
    },
    validators: {
      onChange: z.object({
        name: z.string().check(z.minLength(1, "Cannot be empty")),
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
      className="flex flex-col gap-4"
    >
      <form.AppField
        name="name"
        children={(field) => <field.TextFieldSet placeholder="New Session" />}
      />
      <form.AppForm>
        <form.SubmitButton fullWidth>Create</form.SubmitButton>
      </form.AppForm>
    </form>
  );
}

// TODO: delete
export function DeleteSessionButton({ sessionId }: { sessionId: number }) {
  const { mutateAsync: deleteSession } = useDeleteSession();
  const { deleteIcon } = sessionListTv();

  return (
    <TrashIcon
      className={deleteIcon()}
      onClick={async () => {
        await deleteSession(sessionId);
      }}
    ></TrashIcon>
  );
}
