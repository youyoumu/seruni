import type { IPCRendererHandler } from "@repo/preload";
import { createSignal, For, onCleanup, onMount } from "solid-js";
import { Box } from "styled-system/jsx";
import "./ConsoleTab.css";

const MAX_LOGS = 100;

export function ConsoleTab() {
  const [logs, setLogs] = createSignal<string[]>([]);

  onMount(() => {
    const handler: IPCRendererHandler<"log:send"> = (payload) => {
      setLogs((prev) => [...prev, payload.message].slice(0, MAX_LOGS));
    };
    ipcRenderer.on("log:send", handler);
    onCleanup(() => ipcRenderer.removeListener("log:send", handler));
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
            return <Box>{log}</Box>;
          }}
        </For>
      </Box>
    </Box>
  );
}
