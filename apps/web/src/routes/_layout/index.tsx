import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_layout/")({
  component: IndexPage,
});

function IndexPage() {
  return (
    <div className="p-2">
      <h3 className="text-xl font-bold mb-4">Welcome to Seruni</h3>
      <p className="text-gray-400">Select an option from the sidebar to get started.</p>
    </div>
  );
}
