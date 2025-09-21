import { createFileRoute } from "@tanstack/solid-router";
import { css } from "styled-system/css";
import { Button } from "#/components/ui/button";

export const Route = createFileRoute("/")({
  component: IndexComponent,
});

function IndexComponent() {
  return (
    <div class={css({ bg: "bg.default", p: "2" })}>
      <Button>test2</Button>
    </div>
  );
}
