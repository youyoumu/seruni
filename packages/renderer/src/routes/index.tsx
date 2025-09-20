import { createFileRoute } from "@tanstack/solid-router";

export const Route = createFileRoute("/")({
  component: IndexComponent,
});

function IndexComponent() {
  return <div>test2</div>;
}
