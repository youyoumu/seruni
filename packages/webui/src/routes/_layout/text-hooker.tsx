import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_layout/text-hooker")({
  component: TextHookerPage,
});

function TextHookerPage() {
  return (
    <div className="p-2 bg-surface-faint">
      <h3 className="text-xl font-bold mb-4">Text Hooker</h3>
      <p className="text-gray-400">Text Hooker integration coming soon...</p>
    </div>
  );
}
