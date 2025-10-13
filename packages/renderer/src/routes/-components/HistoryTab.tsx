import type { AnkiHistory } from "@repo/preload/ipc";
import { format, formatRelative } from "date-fns";
import { sort } from "fast-sort";
import { PauseIcon, PlayIcon } from "lucide-solid";
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
import { Portal } from "solid-js/web";
import { css, cva, type RecipeVariantProps } from "styled-system/css";
import { HStack, Stack } from "styled-system/jsx";
import { Dialog } from "#/components/ui/dialog";
import { IconButton } from "#/components/ui/icon-button";
import { Slider } from "#/components/ui/slider";
import { Text } from "#/components/ui/text";
import { store } from "#/lib/store";

export function HistoryTab() {
  const [history, setHistory] = createSignal<AnkiHistory>([]);
  const [ankiMediaUrl, setAnkiMediaUrl] = createSignal("");

  onMount(() => {
    const id = setInterval(async () => {
      const { url } = await ipcRenderer.invoke("mining:getAnkiMediaUrl");
      setAnkiMediaUrl(url);

      const { data } = await ipcRenderer.invoke("mining:getAnkiHistory");
      setHistory(sort(data).desc((item) => item.id));
    }, 5000);
    onCleanup(() => {
      clearInterval(id);
    });
  });

  createEffect(async () => {
    if (store.client.anki.status === "connected") {
      const { data } = await ipcRenderer.invoke("mining:getAnkiHistory");
      setHistory(sort(data).desc((item) => item.id));
    }
  });

  return (
    <Stack h="full" maxW="8xl" mx="auto" gap="4">
      <Stack
        overflow="auto"
        class="custom-scrollbar"
        pe="4"
        gap="4"
        alignItems="center"
      >
        <For each={history()}>
          {(item) => {
            const time = formatRelative(new Date(item.id), new Date());
            const textVariant = cva({
              base: {
                lineClamp: "1",
              },
              variants: {
                wordLength: {
                  1: { fontSize: "6xl" },
                  2: { fontSize: "6xl" },
                  3: { fontSize: "6xl" },
                  4: { fontSize: "6xl" },
                  5: { fontSize: "6xl" },
                  6: { fontSize: "5xl" },
                  7: { fontSize: "5xl" },
                  8: { fontSize: "5xl" },
                  9: { fontSize: "4xl" },
                  10: { fontSize: "4xl" },
                  11: { fontSize: "4xl" },
                  12: { fontSize: "3xl" },
                  13: { fontSize: "3xl" },
                  14: { fontSize: "3xl" },
                  15: { fontSize: "3xl" },
                  16: { fontSize: "2xl" },
                  17: { fontSize: "2xl" },
                  18: { fontSize: "xl" },
                  19: { fontSize: "xl" },
                  20: { fontSize: "xl" },
                  21: { fontSize: "lg" },
                  22: { fontSize: "lg" },
                  23: { fontSize: "lg" },
                  default: { fontSize: "md" },
                },
              },
            });
            type TextVariant = RecipeVariantProps<typeof textVariant>;
            return (
              <Stack
                borderColor="border.default"
                borderWidth="thin"
                p="4"
                rounded="md"
                bg="bg.muted"
                shadow="sm"
                w="full"
                maxW="4xl"
              >
                <HStack gap="4">
                  <Stack
                    flex="1"
                    alignItems="center"
                    p="2"
                    rounded="md"
                    bg="bg.subtle"
                    h="full"
                    justifyContent="center"
                  >
                    <Text size="xs" color="fg.muted">
                      {time}
                    </Text>
                    <Text
                      class={textVariant({
                        wordLength: item.word.length.toString(),
                      } as TextVariant)}
                    >
                      {item.word}
                    </Text>
                    <Show when={item.sentenceAudioPath}>
                      <AudioButton
                        src={`${ankiMediaUrl()}/media/${item.sentenceAudioPath}`}
                      />
                    </Show>
                  </Stack>
                  <Show when={item.picturePath}>
                    <Dialog.Root>
                      <Dialog.Trigger
                        asChild={(triggerProps) => (
                          <img
                            {...triggerProps()}
                            class={css({
                              height: "48",
                              objectFit: "contain",
                              rounded: "md",
                              cursor: "pointer",
                            })}
                            //TODO: change to filename
                            src={`${ankiMediaUrl()}/media/${item.picturePath}`}
                            alt="PictureField"
                          />
                        )}
                      />
                      <Dialog.Backdrop />
                      <Portal
                        mount={document.querySelector("#app") ?? document.body}
                      >
                        <Dialog.Positioner>
                          <Dialog.Content
                            p="4"
                            bg="transparent"
                            boxShadow="[none]"
                            outlineStyle="[none]"
                          >
                            <Dialog.CloseTrigger
                              asChild={(closeTriggerProps) => (
                                <img
                                  {...closeTriggerProps()}
                                  class={css({
                                    w: "full",
                                    maxW: "8xl",
                                    objectFit: "contain",
                                    rounded: "md",
                                    shadow: "md",
                                  })}
                                  src={`${ankiMediaUrl()}/media/${item.picturePath}`}
                                  alt="PictureField"
                                />
                              )}
                            />
                          </Dialog.Content>
                        </Dialog.Positioner>
                      </Portal>
                    </Dialog.Root>
                  </Show>
                </HStack>
              </Stack>
            );
          }}
        </For>
      </Stack>
    </Stack>
  );
}

interface AudioButtonProps {
  src: string;
}

export function AudioButton(props: AudioButtonProps) {
  const [playing, setPlaying] = createSignal(false);
  const [progress, setProgress] = createSignal(0); // 0 → 1

  const audio = new Audio(props.src);

  const toggle = () => {
    if (playing()) {
      audio.pause();
    } else {
      audio.play();
    }
  };

  audio.addEventListener("play", () => setPlaying(true));
  audio.addEventListener("pause", () => setPlaying(false));
  audio.addEventListener("ended", () => setPlaying(false));

  audio.addEventListener("timeupdate", () => {
    if (audio.duration) setProgress((audio.currentTime / audio.duration) * 100);
  });

  onCleanup(() => {
    audio.pause();
    audio.src = "";
  });

  return (
    <Stack alignItems="center">
      <IconButton size="xs" onClick={toggle}>
        <Switch>
          <Match when={playing()}>
            <PauseIcon />
          </Match>
          <Match when={!playing()}>
            <PlayIcon />
          </Match>
        </Switch>
      </IconButton>
      <Slider value={[progress()]} defaultValue={[0]} w="32" />
    </Stack>
  );
}
