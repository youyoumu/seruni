import type { AnkiHistory } from "@repo/preload/ipc";
import { createEffect, createSignal, For, onMount, Show } from "solid-js";
import { css } from "styled-system/css";
import { Box, Stack } from "styled-system/jsx";
import { store } from "#/lib/store";

export function HistoryTab() {
  const [history, setHistory] = createSignal<AnkiHistory>([]);
  const [ankiMediaUrl, setAnkiMediaUrl] = createSignal("");

  onMount(async () => {
    const { url } = await ipcRenderer.invoke("mining:getAnkiMediaUrl");
    setAnkiMediaUrl(url);
  });

  createEffect(async () => {
    if (store.client.anki.status === "connected") {
      const { data } = await ipcRenderer.invoke("mining:getAnkiHistory");
      setHistory(data);
    }
  });

  return (
    <Stack h="full" maxW="8xl" mx="auto" gap="4">
      <Stack overflow="auto" class="custom-scrollbar" pe="4" gap="4">
        <For each={history()}>
          {(item) => {
            return (
              <Stack
                borderColor="border.default"
                borderWidth="thin"
                p="2"
                rounded="md"
                bg="bg.subtle"
                shadow="sm"
              >
                <p>{item.word}</p>
                <img
                  class={css({
                    width: "sm",
                    objectFit: "contain",
                    borderColor: "border.default",
                    borderWidth: "thin",
                    rounded: "md",
                  })}
                  //TODO: change to filename
                  src={`${ankiMediaUrl()}/media/${item.picturePath}`}
                  alt="PictureField"
                />
                <Show when={item.sentenceAudioPath}>
                  <audio
                    controls
                    src={`${ankiMediaUrl()}/media/${item.sentenceAudioPath}`}
                  >
                    <track kind="captions" />
                  </audio>
                </Show>
              </Stack>
            );
          }}
        </For>
      </Stack>
    </Stack>
  );
}
