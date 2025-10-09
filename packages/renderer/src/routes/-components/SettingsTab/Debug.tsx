import stringify from "json-stringify-pretty-compact";
import { createEffect, createSignal, onMount } from "solid-js";
import { Box, Stack } from "styled-system/jsx";
import { Heading } from "#/components/ui/heading";

export function Debug() {
  const [envString, setEnvString] = createSignal("");

  let ready = false;
  createEffect(() => {
    if (!ready) return;
  });

  onMount(async () => {
    const env = await ipcRenderer.invoke("settings:getEnv");
    setEnvString(stringify(env, { indent: 2 }).slice(1, -1));

    ready = true;
  });

  return (
    <Stack gap="2" w="full">
      <Stack>
        <Heading
          size="2xl"
          borderBottomColor="border.default"
          borderBottomWidth="medium"
          pb="2"
        >
          Debug
        </Heading>
      </Stack>
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
  );
}
