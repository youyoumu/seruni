import stringify from "json-stringify-pretty-compact";
import { createEffect, onMount } from "solid-js";
import { Box, Stack } from "styled-system/jsx";
import { Heading } from "#/components/ui/heading";
import { store } from "#/lib/store";

export function Debug() {
  const envString = () =>
    stringify(store.debug.env, { indent: 2 }).slice(1, -1);

  let ready = false;
  createEffect(() => {
    if (!ready) return;
  });

  onMount(async () => {
    ready = true;
  });

  return (
    <Stack gap="2" w="full">
      <Heading
        size="2xl"
        borderBottomColor="border.default"
        borderBottomWidth="medium"
        pb="2"
      >
        Debug
      </Heading>

      <Stack>
        <Heading>ENV</Heading>
        <Box
          as="pre"
          p="2"
          bg="bg.subtle"
          borderWidth="thin"
          borderColor="border.subtle"
          borderRadius="sm"
          fontSize="xs"
          whiteSpace="pre-wrap"
          color="gray.light.8"
        >
          {envString()}
        </Box>
      </Stack>
    </Stack>
  );
}
