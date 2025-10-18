import {
  type AnkiHistory,
  type Media,
  zAnkiCollectionMediaUrlPath,
} from "@repo/preload/ipc";
import { formatRelative } from "date-fns";
import { createEffect, createSignal, onMount, Show } from "solid-js";
import { Portal } from "solid-js/web";
import { css, cva } from "styled-system/css";
import { HStack, Stack } from "styled-system/jsx";
import type { RecipeVariantProps } from "styled-system/types";
import { Button } from "#/components/ui/button";
import { Dialog } from "#/components/ui/dialog";
import { Spinner } from "#/components/ui/spinner";
import { Switch as Toggle } from "#/components/ui/switch";
import { Text } from "#/components/ui/text";
import { store } from "#/lib/store";
import { appToaster } from "../AppToaster";
import { history } from "./_util";
import { AudioButton } from "./AudioButton";

const srcSet = new Set<string>();
const nsfwUpdateLock = new Set<number>();

const expressionVariant = cva({
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

export function AnkiCard(props: { noteId: number }) {
  const note = () =>
    history.find((item) => item.id === props.noteId) as AnkiHistory[number];
  if (!note()) return null;
  //TODO: modify via context
  const [nsfw, setNsfw] = createSignal(note().nsfw);
  const time = () => formatRelative(new Date(note().id), new Date());
  type TextVariant = RecipeVariantProps<typeof expressionVariant>;
  const pictureSrc = () =>
    `${store.general.httpServerUrl}${zAnkiCollectionMediaUrlPath.value}${note().picture}`;
  const sentenceAudioSrc = () =>
    `${store.general.httpServerUrl}${zAnkiCollectionMediaUrlPath.value}${note().sentenceAudio}`;
  const [media, setMedia] = createSignal<Media>([]);

  const pictureMedia = () => media().filter((m) => m.type === "picture");
  const sentenceAudioMedia = () =>
    media().find((m) => m.type === "sentenceAudio");

  onMount(async () => {
    const media = await ipcRenderer.invoke("mining:getNoteMedia", {
      noteId: note().id,
    });
    setMedia(media);
  });

  createEffect(() => {
    console.log(note().id, media());
  });

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
            class={expressionVariant({
              wordLength: note().expression.length.toString(),
            } as TextVariant)}
          >
            {note().expression}
          </Text>
          <Show when={note().sentenceAudio}>
            <AudioButton src={sentenceAudioSrc()} />
          </Show>
        </Stack>
        <Show when={note().picture}>
          <Dialog.Root>
            <Dialog.Trigger
              asChild={(triggerProps) => {
                const [loaded, setLoaded] = createSignal(
                  srcSet.has(pictureSrc()),
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
                        src={pictureSrc()}
                        alt="PictureField"
                        onLoad={() => {
                          setLoaded(true);
                          srcSet.add(pictureSrc());
                        }}
                        onError={() => setError(true)}
                      />
                    </Show>
                    <Show when={pictureSrc() && !loaded() && !error()}>
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
            <Portal mount={document.querySelector("#app") ?? document.body}>
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
                        src={pictureSrc()}
                        alt="PictureField"
                      />
                    )}
                  />
                  <HStack justifyContent="end" px="8">
                    <Toggle
                      checked={nsfw()}
                      onCheckedChange={() => {
                        if (nsfwUpdateLock.has(note().id)) return;
                        nsfwUpdateLock.add(note().id);
                        setNsfw(!nsfw());
                        appToaster.promise(
                          ipcRenderer
                            .invoke("mining:toggleNoteNsfw", {
                              noteId: note().id,
                              checked: nsfw(),
                            })
                            .then((success) => {
                              if (!success) {
                                setNsfw(!nsfw());
                                throw new Error("Failed to update NSFW tag");
                              }
                            })
                            .catch(() => {
                              setNsfw(!nsfw());
                            })
                            .finally(() => {
                              nsfwUpdateLock.delete(note().id);
                            }),
                          {
                            loading: {
                              title: "Updating note NSFW tag...",
                              description: `${note().expression}`,
                            },
                            error: {
                              title: "Failed to update note NSFW tag",
                              description: note().expression,
                            },
                            success: {
                              title: "Note NSFW tag updated",
                              description: `${note().expression}`,
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
        <HStack gap="4" justifyContent="space-between" alignItems="end">
          <HStack>
            <Button size="sm">Open in Anki</Button>
            <Dialog.Root>
              <Dialog.Trigger
                asChild={(triggerProps) => {
                  return (
                    <Button size="sm" {...triggerProps()}>
                      Edit
                    </Button>
                  );
                }}
              />
              <Dialog.Backdrop />
              <Portal mount={document.querySelector("#app") ?? document.body}>
                <Dialog.Positioner>
                  <Dialog.Content></Dialog.Content>
                </Dialog.Positioner>
              </Portal>
            </Dialog.Root>
          </HStack>

          <Text size="xs" color="fg.muted">
            {time()}
          </Text>
        </HStack>
      </Stack>
    </Stack>
  );
}
