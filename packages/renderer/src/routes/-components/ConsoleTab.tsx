import type { IPCRendererHandler } from "@repo/preload";
import { createSignal, For, onCleanup, onMount } from "solid-js";
import { Box } from "styled-system/jsx";

export function ConsoleTab() {
  const [logs, setLogs] = createSignal<string[]>([]);
  onMount(() => {
    const handler: IPCRendererHandler<"log:send"> = (payload) => {
      setLogs((prev) => [...prev, payload.message]);
    };
    ipcRenderer.on("log:send", handler);
    onCleanup(() => ipcRenderer.removeListener("log:send", handler));
  });
  return (
    <Box>
      <For each={logs()}>
        {(log) => {
          return <Box>{log}</Box>;
        }}
      </For>
    </Box>
  );
}
