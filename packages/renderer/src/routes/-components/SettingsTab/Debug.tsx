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
import { cva } from "styled-system/css";
import { Box, Stack } from "styled-system/jsx";
import { Heading } from "#/components/ui/heading";
import { IconButton } from "#/components/ui/icon-button";
import { SettingsQuery } from "#/lib/query/settings";
import { appToaster } from "../AppToaster";

export function Debug() {
  const { PythonQuery, EnvQuery } = SettingsQuery;
  const envString = () =>
    stringify(EnvQuery.detail.query().data, { indent: 2 }) ?? "";

  const isPythonInstalled = () => PythonQuery.isInstalled.use().data === true;
  const isUvInstalled = () => PythonQuery.isUvInstalled.use().data === true;
  const isVenvDependenciesInstalled = () =>
    PythonQuery.venvDependenciesInstalled.use().data === true;

  const pythonPipListString = () =>
    isPythonInstalled()
      ? (stringify(PythonQuery.pipList.use().data, {
          indent: 2,
        }) ?? "")
      : "Python is not installed";

  const pythonVenvPipListString = () =>
    isUvInstalled()
      ? (stringify(PythonQuery.venvPipList.use().data, {
          indent: 2,
        }) ?? "")
      : "uv is not installed";

  const pythonHealthcheckString = () =>
    isPythonInstalled()
      ? (stringify(PythonQuery.healthcheck.use().data, {
          indent: 2,
        }) ?? "")
      : "Python is not installed";

  const pythonVenvHealthcheckString = () =>
    isUvInstalled()
      ? (stringify(PythonQuery.venvHealthcheck.use().data, {
          indent: 2,
        }) ?? "")
      : "uv is not installed";

  let ready = false;
  createEffect(() => {
    if (!ready) return;
  });

  onMount(async () => {
    ready = true;
  });

  createEffect(() => {});

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
          <DebugBox text={envString()} variant="default" />
        </Stack>
        <Stack>
          <Heading>Python PIP list</Heading>
          <DebugBox
            text={pythonPipListString()}
            variant={isPythonInstalled() ? "default" : "error"}
          />
        </Stack>
        <Stack>
          <Heading>Python venv PIP list</Heading>
          <DebugBox
            text={pythonVenvPipListString()}
            variant={isUvInstalled() ? "default" : "error"}
          />
        </Stack>
        <Stack>
          <Heading>Python Healthcheck</Heading>
          <DebugBox
            text={pythonHealthcheckString()}
            variant={
              isPythonInstalled() ? (isUvInstalled() ? "ok" : "warn") : "error"
            }
          />
        </Stack>
        <Stack>
          <Heading>Python venv Healthcheck</Heading>
          <DebugBox
            text={pythonVenvHealthcheckString()}
            variant={
              isUvInstalled()
                ? isVenvDependenciesInstalled()
                  ? "ok"
                  : "warn"
                : "error"
            }
          />
        </Stack>
      </Stack>
    </Suspense>
  );
}

const debugBoxCva = cva({
  base: {
    position: "relative",
    p: "2",
    bg: "bg.subtle",
    borderWidth: "thin",
    borderColor: "border.subtle",
    borderRadius: "sm",
    fontSize: "xs",
    whiteSpace: "pre-wrap",
  },
  variants: {
    status: {
      default: {
        color: "gray.dark.a10",
      },
      ok: {
        color: "green.dark.a11",
      },
      error: {
        color: "fg.error",
      },
      warn: {
        color: "yellow.dark.a9",
      },
    },
  },
});

function DebugBox(props: {
  text: string;
  variant: "default" | "ok" | "error" | "warn";
}) {
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
    <Suspense>
      <Box
        ref={contentRef}
        as="pre"
        class={debugBoxCva({ status: props.variant })}
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
    </Suspense>
  );
}
