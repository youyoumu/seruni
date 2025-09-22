import type { IPCRendererHandler } from "@repo/preload";
import {
  createEffect,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import { Box, HStack } from "styled-system/jsx";
import "./ConsoleTab.css";
import stringify from "json-stringify-pretty-compact";
import { cva } from "styled-system/css";

const MAX_LOGS = 100;

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
  const [logs, setLogs] = createSignal<Log[]>([]);

  onMount(() => {
    const handler: IPCRendererHandler<"log:send"> = (payload) => {
      setLogs((prev) => [...prev, payload].slice(prev.length - MAX_LOGS));
    };
    ipcRenderer.on("log:send", handler);
    onCleanup(() => ipcRenderer.removeListener("log:send", handler));
  });

  let logsRef: HTMLDivElement | undefined;

  createEffect(() => {
    logs();
    if (logsRef) {
      // jump to bottom when logs update
      logsRef.scrollTop = logsRef.scrollHeight;
    }
  });

  return (
    <Box
      h="full"
      borderColor="border.default"
      borderRadius="sm"
      overflow="hidden"
      borderWidth="thin"
      bg="bg.subtle"
    >
      <Box
        ref={logsRef}
        class="console-scrollbar"
        h="full"
        overflow="auto"
        lineHeight="tight"
        fontFamily="jetbrainsMono"
        fontSize="sm"
        p="2"
      >
        <For each={logs()}>
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
              <Box>
                <HStack>
                  <Box>[{new Date(log.time).toLocaleTimeString()}]</Box>
                  <Box width="[56px]">
                    <Box class={logLevelCva({ logLevel })}>{logLevel}</Box>
                  </Box>
                  <Box>{log.message}</Box>
                </HStack>
                <Show when={debugString}>
                  <Box
                    my="2"
                    as="pre"
                    p="2"
                    borderWidth="thin"
                    borderColor="border.subtle"
                    borderRadius="sm"
                    fontSize="xs"
                    whiteSpace="pre-wrap"
                    overflowX="auto"
                  >
                    {debugString}
                  </Box>
                </Show>
              </Box>
            );
          }}
        </For>
      </Box>
    </Box>
  );
}
