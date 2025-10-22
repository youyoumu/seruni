import stringify from "json-stringify-pretty-compact";
import { ClipboardCopyIcon } from "lucide-solid";
import {
  createEffect,
  createSignal,
  onCleanup,
  onMount,
  Show,
  Suspense,
} from "solid-js";
import { Box, Stack } from "styled-system/jsx";
import { Heading } from "#/components/ui/heading";
import { IconButton } from "#/components/ui/icon-button";
import {
  useEnvQuery,
  useIsPythonInstalledQuery,
  usePythonHealthcheckQuery,
  usePythonPipListQuery,
  usePythonVenvHealthcheckQuery,
  usePythonVenvPipListQuery,
} from "#/lib/query/settings";
import { appToaster } from "../AppToaster";

export function Debug() {
  const envQuery = useEnvQuery();
  const envString = () => stringify(envQuery().data, { indent: 2 }) ?? "";

  const isPythonInstalledQuery = useIsPythonInstalledQuery();

  const pythonPipListQuery = usePythonPipListQuery();
  const pythonPipListString = () =>
    stringify(pythonPipListQuery().data, {
      indent: 2,
    }) ?? "";

  const pythonVenvPipListQuery = usePythonVenvPipListQuery();
  const pythonVenvPipListString = () =>
    stringify(pythonVenvPipListQuery().data, { indent: 2 }) ?? "";

  const pythonHealthcheckQuery = usePythonHealthcheckQuery();
  const pythonHealthcheckString = () =>
    stringify(pythonHealthcheckQuery().data, { indent: 2 }) ?? "";

  const pythonVenvHealthcheckQuery = usePythonVenvHealthcheckQuery();
  const pythonVenvHealthcheckString = () =>
    stringify(pythonVenvHealthcheckQuery().data, { indent: 2 }) ?? "";

  let ready = false;
  createEffect(() => {
    if (!ready) return;
  });

  onMount(async () => {
    ready = true;
  });

  createEffect(() => {
    console.log(
      pythonPipListQuery().isEnabled,
      isPythonInstalledQuery().isEnabled,
    );
  });

  return (
    <Suspense>
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
          <DebugBox text={pythonPipListString()} />
        </Stack>
        <Stack>
          <Heading>Python venv PIP list</Heading>
          <DebugBox text={pythonVenvPipListString()} />
        </Stack>
        <Stack>
          <Heading>Python Healthcheck</Heading>
          <DebugBox text={pythonHealthcheckString()} />
        </Stack>
        <Stack>
          <Heading>Python venv Healthcheck</Heading>
          <DebugBox text={pythonVenvHealthcheckString()} />
        </Stack>
      </Stack>
    </Suspense>
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
