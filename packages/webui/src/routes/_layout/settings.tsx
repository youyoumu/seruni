import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_layout/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <div className="p-2">
      <h3 className="mb-4 text-xl font-bold">Settings page </h3>
      <p className="text-gray-400">Select an option from the sidebar to get started.</p>
    </div>
  );
}
