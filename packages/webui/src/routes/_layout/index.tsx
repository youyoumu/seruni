import { createFileRoute } from "@tanstack/react-router";
import { TurtleIcon } from "lucide-react";

export const Route = createFileRoute("/_layout/")({
  component: IndexPage,
});

function IndexPage() {
  return (
    <div className="flex h-full items-center justify-center">
      <TurtleIcon className="size-64 text-surface-foreground-faint" strokeWidth={1}></TurtleIcon>
    </div>
  );
}
