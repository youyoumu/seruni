import { createEffect, onMount, Suspense } from "solid-js";
import { Grid, Stack } from "styled-system/jsx";

export function DebugTab() {
  onMount(() => {});

  createEffect(() => {});

  return (
    <Suspense>
      <Stack gap="4" maxW="8xl" mx="auto">
        <Grid
          gap="2"
          gridTemplateColumns="repeat(auto-fit, minmax(200px, 1fr))"
        ></Grid>
      </Stack>
    </Suspense>
  );
}
