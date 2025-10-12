import type { AnkiHistory } from "@repo/preload/ipc";
import { createEffect, createSignal, For } from "solid-js";
import { Stack } from "styled-system/jsx";
import { store } from "#/lib/store";

export function HistoryTab() {
  const [history, setHistory] = createSignal<AnkiHistory>([]);
  createEffect(async () => {
    if (store.client.anki.status === "connected") {
      const { data } = await ipcRenderer.invoke("mining:getAnkiHistory");
      console.log("DEBUG[696]: data=", data);
      setHistory(data);
    }
  });

  return (
    <Stack h="full" maxW="8xl" mx="auto">
      <For each={history()}>
        {(item) => {
          return (
            <Stack>
              <p>{item.word}</p>
              <p>{item.picturePath}</p>
              <p>{item.sentenceAudioPath}</p>
            </Stack>
          );
        }}
      </For>
    </Stack>
  );
}
