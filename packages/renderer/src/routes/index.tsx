import { createFileRoute } from "@tanstack/solid-router";
import { css } from "#styled-system/css";

export const Route = createFileRoute("/")({
  component: IndexComponent,
});

function IndexComponent() {
  return <div class={css({ bg: "rose.400" })}>test2</div>;
}
