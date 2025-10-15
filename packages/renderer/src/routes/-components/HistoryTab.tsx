import { usePagination } from "@ark-ui/solid";
import {
  type AnkiHistory,
  zAnkiCollectionMediaUrlPath,
} from "@repo/preload/ipc";
import { formatRelative } from "date-fns";
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
import { Box, HStack, Stack } from "styled-system/jsx";
import { Button } from "#/components/ui/button";
import { Dialog } from "#/components/ui/dialog";
import { IconButton } from "#/components/ui/icon-button";
import { Pagination } from "#/components/ui/pagination";
import { Slider } from "#/components/ui/slider";
import { Spinner } from "#/components/ui/spinner";
import { Switch as Toggle } from "#/components/ui/switch";
import { Text } from "#/components/ui/text";
import { store } from "#/lib/store";
import { appToaster } from "./AppToaster";

const srcMap = new Map<string, true>();
const nsfwUpdateLock = new Map<number, boolean>();

export function HistoryTab() {
  const [history, setHistory] = createSignal<AnkiHistory>([]);
  const [httpServerUrl, setAnkiMediaUrl] = createSignal("");

  const [currentPage, setCurrentPage] = createSignal(1);
  const [pageSize, setPageSize] = createSignal(25);
  const [slicedHistory, setSlicedHistory] = createSignal<AnkiHistory>([]);

  createEffect(() => {
    const count = history().length;
    const pagination = usePagination({
      count,
      pageSize: pageSize(),
      page: currentPage(),
    });
    setSlicedHistory(pagination().slice(history()));
  });

  let id = setInterval(() => {});
  onMount(async () => {
    const { url } = await ipcRenderer.invoke("general:httpServerUrl");
    setAnkiMediaUrl(url);

    const { data } = await ipcRenderer.invoke("mining:getAnkiHistory");
    setHistory(sort(data).desc((item) => item.id));
    id = setInterval(async () => {
      const { data } = await ipcRenderer.invoke("mining:getAnkiHistory");
      if (history().length !== data.length) {
        setHistory(sort(data).desc((item) => item.id));
      }
    }, 5000);
  });

  onCleanup(() => {
    clearInterval(id);
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
        <For each={slicedHistory()}>
          {(item) => {
            const [nsfw, setNsfw] = createSignal(item.nsfw);
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
            const pictureSrc = `${httpServerUrl()}${zAnkiCollectionMediaUrlPath.value}${item.picture}`;
            const sentenceAudioSrc = `${httpServerUrl()}${zAnkiCollectionMediaUrlPath.value}${item.sentenceAudio}`;
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
                    <Text
                      class={textVariant({
                        wordLength: item.expression.length.toString(),
                      } as TextVariant)}
                    >
                      {item.expression}
                    </Text>
                    <Show when={item.sentenceAudio}>
                      <AudioButton src={sentenceAudioSrc} />
                    </Show>
                  </Stack>
                  <Show when={item.picture}>
                    <Dialog.Root>
                      <Dialog.Trigger
                        asChild={(triggerProps) => {
                          const [loaded, setLoaded] = createSignal(
                            srcMap.has(pictureSrc),
                          );
                          const [error, setError] = createSignal(false);
                          return (
                            <>
                              <Show when={!error() && pictureSrc}>
                                <img
                                  {...triggerProps()}
                                  class={css({
                                    height: "48",
                                    objectFit: "contain",
                                    rounded: "md",
                                    cursor: "pointer",
                                    filter: nsfw()
                                      ? "[blur(12px) brightness(0.5)]"
                                      : "auto",
                                    _hover: {
                                      filter: "[blur(0px) brightness(1)]",
                                    },
                                    transition: "[filter 0.2s ease-in-out]",
                                  })}
                                  style={{
                                    display: loaded() ? "block" : "none",
                                  }}
                                  src={pictureSrc}
                                  alt="PictureField"
                                  onLoad={() => {
                                    setLoaded(true);
                                    srcMap.set(pictureSrc, true);
                                  }}
                                  onError={() => setError(true)}
                                />
                              </Show>
                              <Show when={pictureSrc && !loaded() && !error()}>
                                <Stack
                                  class={css({
                                    height: "48",
                                    aspectRatio: "16 / 9",
                                    alignItems: "center",
                                    justifyContent: "center",
                                  })}
                                >
                                  <Spinner size="lg" />
                                </Stack>
                              </Show>
                            </>
                          );
                        }}
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
                            display="flex"
                            flexDirection="column"
                            gap="4"
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
                                  src={pictureSrc}
                                  alt="PictureField"
                                />
                              )}
                            />
                            <HStack justifyContent="end" px="8">
                              <Toggle
                                checked={nsfw()}
                                onCheckedChange={() => {
                                  if (nsfwUpdateLock.get(item.id)) return;
                                  setNsfw(!nsfw());
                                  appToaster.promise(
                                    ipcRenderer
                                      .invoke("mining:toggleNoteNsfw", {
                                        noteId: item.id,
                                        checked: nsfw(),
                                      })
                                      .then((success) => {
                                        if (!success) {
                                          setNsfw(!nsfw());
                                          throw new Error(
                                            "Failed to update NSFW tag",
                                          );
                                        }
                                      })
                                      .catch(() => {
                                        setNsfw(!nsfw());
                                      })
                                      .finally(() => {
                                        nsfwUpdateLock.delete(item.id);
                                      }),
                                    {
                                      loading: {
                                        title: "Updating note NSFW tag...",
                                        description: `${item.expression}`,
                                      },
                                      error: {
                                        title: "Failed to update note NSFW tag",
                                        description: item.expression,
                                      },
                                      success: {
                                        title: "Note NSFW tag updated",
                                        description: `${item.expression}`,
                                      },
                                    },
                                  );
                                }}
                              >
                                NSFW
                              </Toggle>
                            </HStack>
                          </Dialog.Content>
                        </Dialog.Positioner>
                      </Portal>
                    </Dialog.Root>
                  </Show>
                </HStack>
                <Stack>
                  <HStack
                    gap="4"
                    justifyContent="space-between"
                    alignItems="end"
                  >
                    <HStack>
                      <Button size="sm">Open in Anki</Button>
                      <Button size="sm">Trim audio</Button>
                    </HStack>

                    <Text size="xs" color="fg.muted">
                      {time}
                    </Text>
                  </HStack>
                </Stack>
              </Stack>
            );
          }}
        </For>
      </Stack>
      <Pagination
        justifyContent="center"
        count={history().length}
        pageSize={pageSize()}
        siblingCount={3}
        page={currentPage()}
        onPageChange={(page) => setCurrentPage(page.page)}
      />
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
