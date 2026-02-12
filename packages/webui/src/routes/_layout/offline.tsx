import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_layout/offline")({
  component: RouteComponent,
});

function RouteComponent() {
  /* //TODO: pretty loading */
  return <div>Hello "/_layout/offline"!</div>;
}
