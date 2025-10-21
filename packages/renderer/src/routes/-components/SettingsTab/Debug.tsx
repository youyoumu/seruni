import stringify from "json-stringify-pretty-compact";
import { ClipboardCopyIcon } from "lucide-solid";
import { createEffect, createSignal, onCleanup, onMount, Show } from "solid-js";
import { Box, Stack } from "styled-system/jsx";
import { Heading } from "#/components/ui/heading";
import { IconButton } from "#/components/ui/icon-button";
import { envQuery } from "#/lib/query/settings";
import { setStore, store } from "#/lib/store";
import { checkPython } from "#/lib/util";
import { appToaster } from "../AppToaster";

export function Debug() {
  const envString = () => stringify(envQuery().data, { indent: 2 }) ?? "";
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

  createEffect(() => {});

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
        <Heading>Python venv PIP list</Heading>
        <DebugBox text={pythonVenvPipList()} />
      </Stack>
      <Stack>
        <Heading>Python Healthcheck</Heading>
        <DebugBox text={pythonHealthcheck()} />
      </Stack>
      <Stack>
        <Heading>Python venv Healthcheck</Heading>
        <DebugBox text={pythonVenvCheckhealth()} />
      </Stack>
    </Stack>
  );
}

function DebugBox(props: { text: string }) {
  const [showClipboard, setShowClipboard] = createSignal(false);

  let contentRef: HTMLDivElement | undefined;

  const abortController = new AbortController();
  onMount(() => {
    if (contentRef) {
      const checkOverflow = () => {
        if (contentRef.scrollHeight === 0) return;
        setShowClipboard(contentRef.scrollHeight > 50);
      };
      checkOverflow();
      const observer = new ResizeObserver(checkOverflow);
      observer.observe(contentRef);

      abortController.signal.addEventListener("abort", () => {
        observer.disconnect();
      });
    }
  }); // recalc when content changes
  onCleanup(() => abortController.abort());

  return (
    <Box
      ref={contentRef}
      position="relative"
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
      <Show when={showClipboard()}>
        <IconButton
          position="absolute"
          bottom="2"
          right="2"
          variant="ghost"
          size="xs"
          p="1.5"
          color="fg.muted"
          onClick={() => {
            if (props.text) navigator.clipboard.writeText(props.text);
            appToaster.create({
              title: "Copied to clipboard",
              description: `${props.text.slice(0, 50)}...`,
              duration: 2000,
            });
          }}
          asChild={(props) => {
            return <ClipboardCopyIcon {...props()} />;
          }}
        ></IconButton>
      </Show>
    </Box>
  );
}
