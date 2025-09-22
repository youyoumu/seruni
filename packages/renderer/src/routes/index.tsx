import { createFileRoute } from "@tanstack/solid-router";
import { Page } from "./-components/Page";

export const Route = createFileRoute("/")({
  component: Page,
});
