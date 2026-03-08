import { useAppForm } from "#/hooks/form";
import { useServices } from "#/hooks/services";
import { useDeleteSession, useSession$, useUpdateSession } from "#/hooks/sessions";
import { formatDuration } from "#/hooks/timer";
import { Button, Separator, Skeleton, tv } from "@heroui/react";
import { zSession } from "@repo/shared/db";
import { createFileRoute } from "@tanstack/react-router";
import { isEqual, randomInt, range } from "es-toolkit";
import { Suspense, useState } from "react";

export const Route = createFileRoute("/_layout/text-hooker/$sessionId/edit")({
  component: EditSessionPage,
  params: {
    parse: (params) => ({
      sessionId: Number(params.sessionId),
    }),
  },
});

const editSessionTv = tv({
  slots: {
    header: "text-2xl font-bold",
    groupSection: "flex flex-col gap-4",
    groupInput: "grid grid-cols-[repeat(auto-fill,_minmax(320px,_1fr))] gap-4",
  },
});

function FallbackEditSessionPage() {
  const [skeletonCount] = useState(randomInt(3, 5));

  return (
    <div className="flex w-full max-w-7xl flex-col gap-12 px-4 pt-8 pb-16">
      {range(skeletonCount).map((_, i) => (
        <Skeleton key={i} className={`h-6 w-full rounded-lg`} />
      ))}
    </div>
  );
}

function EditSessionPage() {
  return (
    <Suspense fallback={<FallbackEditSessionPage />}>
      <EditSessionForm />
    </Suspense>
  );
}

function EditSessionForm() {
  const { sessionId } = Route.useParams();
  const { toast } = useServices();
  const { header, groupSection, groupInput } = editSessionTv();
  const { data: session } = useSession$(Number(sessionId));
  const { mutate: updateSession } = useUpdateSession();
  const { mutate: deleteSession } = useDeleteSession();

  const form = useAppForm({
    defaultValues: { ...session },
    validators: {
      onChange: zSession,
    },
    onSubmit: async ({ value }) => {
      const newValue = zSession.parse(value);
      updateSession(newValue, {
        onSuccess() {
          if (!isEqual(session, newValue)) toast.success("Session has been updated");
        },
      });
    },
  });

  return (
    <div className="w-full max-w-7xl p-4 pb-32">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          await form.handleSubmit();
        }}
        className="flex flex-col gap-4"
      >
        <div className={groupSection()}>
          <h3 className={header()}>Edit Session</h3>
          <div className={groupInput()}>
            <form.AppField
              name="name"
              children={(field) => (
                <field.TextFieldSet label="Session Name" placeholder="Enter session name" />
              )}
            />

            <form.AppField
              name="duration"
              children={(field) => (
                <field.TextFieldSet
                  label="Duration (s)"
                  type="number"
                  min={0}
                  defaultValue={session.duration}
                  description={formatDuration(field.state.value)}
                />
              )}
            />
          </div>

          <form.AppForm>
            <div className="flex justify-start">
              <form.SubmitButton>Save</form.SubmitButton>
            </div>
          </form.AppForm>

          <Separator />
        </div>

        <div className={groupSection()}>
          <h3 className={header()}>Management</h3>
          <div>
            <Button
              className="bg-danger text-danger-foreground"
              onClick={() => {
                deleteSession(session.id);
              }}
            >
              Delete Session
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
