import type { IPCRendererHandler } from "@repo/preload/ipc";
import { makePersisted } from "@solid-primitives/storage";
import stringify from "json-stringify-pretty-compact";
import { ChevronDown, ChevronUp } from "lucide-solid";
import {
  createEffect,
  createSignal,
  For,
  Match,
  onCleanup,
  onMount,
  Show,
  Switch,
} from "solid-js";
import { cva } from "styled-system/css";
import { Box, HStack, Stack } from "styled-system/jsx";
import { IconButton } from "#/components/ui/icon-button";
import { Slider } from "#/components/ui/slider";

const MAX_LOGS = 1000;
const [state, setState] = hmr.createState<{ logs: Log[] }>(
  Symbol.for("ConsoleTab"),
);

type Log = Parameters<IPCRendererHandler<"log:send">>[0];

const logLevelCva = cva({
  base: {
    px: "1",
    borderWidth: "thin",
    borderColor: "border.default",
    w: "fit",
  },
  variants: {
    logLevel: {
      trace: { color: "sky.11", bg: "sky.3" }, // light blue
      debug: { color: "mint.11", bg: "mint.3" }, // greenish
      info: { color: "blue.11", bg: "blue.3" }, // neutral blue
      warn: { color: "amber.11", bg: "amber.3" }, // yellow/orange
      error: { color: "red.11", bg: "red.3" }, // red
      fatal: { color: "crimson.11", bg: "crimson.3" }, // red
      unknown: { color: "sand.11", bg: "sand.3" }, // gray
    },
  },
});

export function ConsoleTab() {
  const [logLevel, setLogLevel] = makePersisted(createSignal(10), {
    name: "logLevel",
  });
  const [logs, setLogs] = createSignal<Log[]>([]);

  onMount(() => {
    const logs = state().logs;
    if (logs) setLogs(logs);

    const handler: IPCRendererHandler<"log:send"> = (payload) => {
      setLogs((prev) => [...prev, payload].slice(prev.length - MAX_LOGS));
    };
    ipcRenderer.on("log:send", handler);
    onCleanup(() => ipcRenderer.removeListener("log:send", handler));
  });

  let logsRef: HTMLDivElement | undefined;

  createEffect(() => {
    setState({ logs: logs() });

    logs();
    if (logsRef) {
      // jump to bottom when logs update
      logsRef.scrollTop = logsRef.scrollHeight;
    }
  });

  return (
    <Stack
      gap="8"
      h="full"
      borderRadius="sm"
      overflow="hidden"
      maxW="8xl"
      mx="auto"
    >
      <Slider
        px="8"
        value={[logLevel()]}
        onValueChange={(details) => setLogLevel(details.value[0] ?? 10)}
        step={10}
        marks={[
          { value: 10, label: "TRACE" },
          { value: 20, label: "DEBUG" },
          { value: 30, label: "INFO" },
          { value: 40, label: "WARN" },
          { value: 50, label: "ERROR" },
          { value: 60, label: "FATAL" },
        ]}
        min={10}
        max={60}
      />
      <Box
        ref={logsRef}
        borderWidth="thin"
        bg="bg.subtle"
        borderColor="border.default"
        class="custom-scrollbar"
        h="full"
        overflowY="scroll"
        overflowX="scroll"
        lineHeight="tight"
        fontFamily="jetbrainsMono"
        fontSize="sm"
        p="2"
      >
        <For
          each={logs()
            .slice(logs().length - MAX_LOGS)
            .filter((log) => {
              const logLevel_ = log.context.logLevel as number;
              //TODO: slider ui
              return logLevel_ >= logLevel();
            })}
        >
          {(log) => {
            const logLevel_ = log.context.logLevel as number;
            const logLevel = (() => {
              switch (logLevel_) {
                case 10:
                  return "trace";
                case 20:
                  return "debug";
                case 30:
                  return "info";
                case 40:
                  return "warn";
                case 50:
                  return "error";
                case 60:
                  return "fatal";
                default:
                  return "unknown";
              }
            })();

            const debugObj = structuredClone(log.context);
            delete debugObj.logLevel;
            const debugString = Object.keys(debugObj).length
              ? stringify(debugObj, { indent: 2 }).slice(1, -1)
              : undefined;

            return (
              <Stack gap="1" mb="1">
                <HStack alignItems="start">
                  <HStack alignItems="center">
                    <Box whiteSpace="nowrap" fontSize="xs" color="gray.light.9">
                      [{new Date(log.time).toLocaleTimeString()}]
                    </Box>
                    <Box width="[53px]">
                      <Box class={logLevelCva({ logLevel })}>{logLevel}</Box>
                    </Box>
                  </HStack>
                  <Box
                    color={logLevel === "trace" ? "fg.muted" : undefined}
                    whiteSpace="pre-wrap" // preserves line breaks
                    wordBreak="break-all" // allows breaking long words
                  >
                    {log.message}
                  </Box>
                </HStack>
                <Show when={debugString}>
                  <DebugBox debugString={debugString ?? ""} />
                </Show>
              </Stack>
            );
          }}
        </For>
      </Box>
    </Stack>
  );
}

function DebugBox({ debugString }: { debugString: string }) {
  const [expanded, setExpanded] = createSignal(false);
  const [isOverflowing, setIsOverflowing] = createSignal(false);

  let contentRef: HTMLDivElement | undefined;

  const COLLAPSED_HEIGHT = 150; // px

  createEffect(() => {
    if (contentRef) {
      setIsOverflowing(contentRef.scrollHeight > COLLAPSED_HEIGHT);
    }
  }); // recalc when content changes

  return (
    <Box
      ref={contentRef}
      class="custom-scrollbar"
      as="pre"
      p="2"
      borderWidth="thin"
      borderColor="border.subtle"
      borderRadius="sm"
      fontSize="xs"
      whiteSpace="pre-wrap"
      color="gray.light.8"
      overflow="hidden" // hide overflowing content when collapsed
      transition="size"
      style={{
        height: !isOverflowing()
          ? undefined
          : expanded()
            ? undefined
            : `${COLLAPSED_HEIGHT}px`,
      }}
    >
      <Box position="relative">
        {debugString}

        <IconButton
          style={{
            display: isOverflowing() ? "block" : "none",
          }}
          position="absolute"
          top="0"
          right="0"
          variant="ghost"
          size="xs"
          onClick={() => setExpanded(!expanded())}
          asChild={(props) => {
            return (
              <Switch>
                <Match when={expanded()}>
                  <ChevronUp {...props()} />
                </Match>
                <Match when={!expanded()}>
                  <ChevronDown {...props()} />
                </Match>
              </Switch>
            );
          }}
        ></IconButton>
      </Box>
    </Box>
  );
}
