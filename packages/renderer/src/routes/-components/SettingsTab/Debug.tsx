import stringify from "json-stringify-pretty-compact";
import { createEffect, onMount } from "solid-js";
import { Box, Stack } from "styled-system/jsx";
import { Heading } from "#/components/ui/heading";
import { setStore, store } from "#/lib/store";
import { checkPython } from "#/lib/util";

export function Debug() {
  const envString = () =>
    stringify(store.debug.env, { indent: 2 }).slice(1, -1);
  const pythonPipList = () =>
    stringify(store.debug.python.pythonPipList, {
      indent: 2,
    });
  const pythonVenvPipList = () =>
    stringify(store.debug.python.pythonVenvPipList, {
      indent: 2,
    });
  const pythonHealthcheck = () =>
    stringify(store.debug.python.pythonHealthcheck, {
      indent: 2,
    });
  const pythonVenvCheckhealth = () =>
    stringify(store.debug.python.pythonVenvHealthcheck, {
      indent: 2,
    });

  let ready = false;
  createEffect(() => {
    if (!ready) return;
  });

  onMount(async () => {
    ready = true;
    checkPython();
  });

  createEffect(async () => {
    if (!store.debug.python.isInstalled) return;
    const pythonHealthcheck = await ipcRenderer.invoke(
      "settings:pythonHealthcheck",
    );
    setStore("debug", "python", "pythonHealthcheck", pythonHealthcheck);

    if (!store.debug.python.isUvInstalled) return;
    const pythonVenvPipList = await ipcRenderer.invoke(
      "settings:pythonVenvPipList",
    );
    setStore("debug", "python", "pythonVenvPipList", pythonVenvPipList);
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
        <DebugBox text={envString()} />
      </Stack>
      <Stack>
        <Heading>Python PIP list</Heading>
        <DebugBox text={pythonPipList()} />
      </Stack>
      <Stack>
        <Heading>Pyhon venv PIP list</Heading>
        <DebugBox text={pythonVenvPipList()} />
      </Stack>
      <Stack>
        <Heading>Pyhon Healthcheck</Heading>
        <DebugBox text={pythonHealthcheck()} />
      </Stack>
      <Stack>
        <Heading>Pyhon venv Healthcheck</Heading>
        <DebugBox text={pythonVenvCheckhealth()} />
      </Stack>
    </Stack>
  );
}

function DebugBox(props: { text: string }) {
  return (
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
      {props.text}
    </Box>
  );
}
