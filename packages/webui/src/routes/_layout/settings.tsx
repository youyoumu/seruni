import { useConfig$ } from "#/hooks/config";
import { useAppForm } from "#/hooks/form";
import { tv } from "@heroui/react";
import { zConfig } from "@repo/shared/schema";
import { createFileRoute } from "@tanstack/react-router";
import * as z from "zod/mini";

export const Route = createFileRoute("/_layout/settings")({
  component: SettingsPage,
});

const settingsTv = tv({
  slots: {
    header: "text-xl font-bold",
  },
});

function SettingsPage() {
  const { header } = settingsTv();
  const { data: config } = useConfig$();

  const form = useAppForm({
    defaultValues: { ...config },
    validators: {
      onChange: zConfig,
    },
    onSubmit: async ({ value }) => {
      console.log(value);
    },
  });

  return (
    <div className="flex h-full items-center justify-center">
      <div className="w-full max-w-7xl p-4">
        <h3 className={header()}>Anki</h3>
      </div>
    </div>
  );
}
