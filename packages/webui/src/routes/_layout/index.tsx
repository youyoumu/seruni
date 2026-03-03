import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_layout/")({
  component: IndexPage,
});

function IndexPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center">
      <div
        className="font-serif text-surface-foreground-faint"
        style={{ fontSize: "256px", lineHeight: 1 }}
      >
        菊
      </div>
      <div className="text-4xl text-surface-foreground-faint">Seruni</div>
    </div>
  );
}
