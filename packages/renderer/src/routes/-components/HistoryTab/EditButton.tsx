import type { NoteMediaSrc } from "@repo/preload/ipc";
import { ArrowRightIcon, ZoomInIcon } from "lucide-solid";
import {
  createEffect,
  createSelector,
  createSignal,
  For,
  Show,
  Suspense,
} from "solid-js";
import { Portal } from "solid-js/web";
import { css, cva } from "styled-system/css";
import { Box, Grid, HStack, Stack } from "styled-system/jsx";
import { Button } from "#/components/ui/button";
import { Dialog } from "#/components/ui/dialog";
import { GeneralQuery } from "#/lib/query/general";
import { MiningQuery } from "#/lib/query/mining";
import { ImageWithFallback } from "./ImageWithFallback";
import { MediaSrcContextProvider, useMediaSrcContext } from "./MediaSrcContext";
import { useNoteContext } from "./NoteContext";
import { PictureWithZoom } from "./PictureWithZoom";

export function EditButton() {
  const { NoteMediaQuery } = MiningQuery;
  const note = useNoteContext();
  const noteMediaQuery = NoteMediaQuery.one.use({ noteId: note.id });
  const availablePictures = () =>
    noteMediaQuery.data.filter((m) => m.type === "picture");

  const [selectedMedisSrc, setSelectedMediaSrc] = createSignal<NoteMediaSrc>({
    fileName: note.picture,
    source: "anki",
  });
  const isSelected = createSelector(selectedMedisSrc, (a, b) => {
    return a.fileName === b.fileName && a.source === b.source;
  });

  createEffect(() => {});

  return (
    <Suspense>
      <Dialog.Root lazyMount>
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
          <Dialog.Positioner p="4">
            <Dialog.Content w="full" maxW="5xl" p="8" maxH="[80svh]">
              <Suspense>
                <Stack gap="8">
                  <HStack justifyContent="center" maxH="64">
                    <MediaSrcContextProvider
                      value={createSignal<NoteMediaSrc>({
                        fileName: note.picture,
                        source: "anki" as const,
                      })}
                    >
                      <Box flex="1" bg="bg.subtle" rounded="sm">
                        <CurrentImage
                          isSelected={
                            selectedMedisSrc().fileName === note.picture &&
                            selectedMedisSrc().source === "anki"
                          }
                          onClick={() => {
                            setSelectedMediaSrc({
                              fileName: note.picture,
                              source: "anki",
                            });
                          }}
                        />
                      </Box>
                    </MediaSrcContextProvider>
                    <Box flexBasis="24">
                      <ArrowRightIcon
                        class={css({
                          h: "full",
                          w: "full",
                          maxW: "24",
                          color: "fg.subtle",
                        })}
                        strokeWidth="1"
                      />
                    </Box>
                    <MediaSrcContextProvider
                      value={[selectedMedisSrc, setSelectedMediaSrc]}
                    >
                      <Box flex="1" bg="bg.subtle" rounded="sm">
                        <SelectedImage />
                      </Box>
                    </MediaSrcContextProvider>
                  </HStack>
                  <Grid
                    gridTemplateColumns="repeat(auto-fit, minmax(160px, 1fr))"
                    gap="4"
                  >
                    <For each={availablePictures()}>
                      {(item) => {
                        return (
                          <MediaSrcContextProvider
                            value={createSignal<NoteMediaSrc>({
                              fileName: item.fileName,
                              source: "storage",
                            })}
                          >
                            <Box bg="bg.subtle" rounded="sm">
                              <AvailableImage
                                isSelected={isSelected({
                                  fileName: item.fileName,
                                  source: "storage",
                                })}
                                onClick={() => {
                                  setSelectedMediaSrc({
                                    fileName: item.fileName,
                                    source: "storage",
                                  });
                                }}
                              />
                            </Box>
                          </MediaSrcContextProvider>
                        );
                      }}
                    </For>
                  </Grid>
                </Stack>
              </Suspense>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </Suspense>
  );
}

const zoomIconCva = cva({
  base: {
    opacity: 0,
    transition: "opacity",
    cursor: "pointer",
    rounded: "sm",
    bg: "bg.default",
    w: "6",
    h: "6",
    p: "1",
    position: "absolute",
    top: "2",
    right: "2",
    strokeWidth: "1.5",
    borderColor: "border.default",
    borderWidth: "thin",
    color: "fg.muted",
  },
  variants: {
    size: {
      default: {
        w: "8",
        h: "8",
      },
      sm: {
        p: "0.5",
        top: "1",
        right: "1",
        w: "6",
        h: "6",
      },
    },
  },
});

function SelectedImage() {
  const { HttpServerUrlQuery } = GeneralQuery;
  const note = useNoteContext();
  const [mediaSrc] = useMediaSrcContext();
  const mediaUrlQuery = HttpServerUrlQuery.mediaUrl.use(
    () => mediaSrc().fileName,
    () => mediaSrc().source,
  );
  const src = () => mediaUrlQuery.data ?? "";
  createEffect(() => {});

  return (
    <PictureWithZoom
      src={src()}
      trigger={(triggerProps) => {
        return (
          <Box position="relative">
            <ImageWithFallback
              src={src()}
              image={(imageProps) => {
                return (
                  <img
                    {...triggerProps()}
                    {...imageProps()}
                    class={css({
                      aspectRatio: "16 / 9",
                      width: "full",
                      height: "full",
                      objectFit: "contain",
                      rounded: "sm",
                      cursor: "pointer",
                    })}
                    src={src()}
                    alt="PictureField"
                  />
                );
              }}
            />
          </Box>
        );
      }}
    />
  );
}

function CurrentImage(props: { onClick: () => void; isSelected: boolean }) {
  const { HttpServerUrlQuery } = GeneralQuery;
  const note = useNoteContext();
  const [mediaSrc] = useMediaSrcContext();
  const mediaUrlQuery = HttpServerUrlQuery.mediaUrl.use(
    () => mediaSrc().fileName,
    () => mediaSrc().source,
  );
  const src = () => mediaUrlQuery.data ?? "";
  const [error, setError] = createSignal(false);

  createEffect(() => {});

  return (
    <PictureWithZoom
      src={src()}
      trigger={(triggerProps) => {
        return (
          <Box
            class={css({
              position: "relative",
              "&:hover > svg": {
                opacity: 1,
              },
            })}
          >
            <Show when={!error()}>
              <ZoomInIcon
                {...triggerProps()}
                class={zoomIconCva({ size: "default" })}
              />
            </Show>
            <ImageWithFallback
              onErrorChange={setError}
              src={src()}
              image={(imageProps) => {
                return (
                  <img
                    {...imageProps()}
                    onClick={props.onClick}
                    class={css({
                      outlineColor: props.isSelected
                        ? "colorPalette.default"
                        : "transparent",
                      outlineWidth: "medium",
                      outlineStyle: "solid",
                      transition: "[outline-color 0.1s]",
                      height: "full",
                      width: "full",
                      aspectRatio: "16 / 9",
                      objectFit: "contain",
                      rounded: "sm",
                      cursor: "pointer",
                    })}
                    src={src()}
                    alt="PictureField"
                  />
                );
              }}
            />
          </Box>
        );
      }}
    />
  );
}

function AvailableImage(props: { onClick: () => void; isSelected: boolean }) {
  const { HttpServerUrlQuery } = GeneralQuery;
  const note = useNoteContext();
  const [mediaSrc] = useMediaSrcContext();
  const mediaUrlQuery = HttpServerUrlQuery.mediaUrl.use(
    () => mediaSrc().fileName,
    () => mediaSrc().source,
  );
  const src = () => mediaUrlQuery.data ?? "";
  const [error, setError] = createSignal(false);

  return (
    <PictureWithZoom
      src={src()}
      trigger={(triggerProps) => {
        return (
          <Box
            class={css({
              position: "relative",
              "&:hover > svg": {
                opacity: 1,
              },
            })}
          >
            <Show when={!error()}>
              <ZoomInIcon
                {...triggerProps()}
                class={zoomIconCva({ size: "sm" })}
              />
            </Show>
            <ImageWithFallback
              onErrorChange={setError}
              src={src()}
              image={(imageProps) => {
                return (
                  <img
                    {...imageProps()}
                    onClick={props.onClick}
                    class={css({
                      outlineColor: props.isSelected
                        ? "colorPalette.default"
                        : "transparent",
                      outlineWidth: "medium",
                      outlineStyle: "solid",
                      transition: "[outline-color 0.1s]",
                      aspectRatio: "16 / 9",
                      height: "full",
                      width: "full",
                      objectFit: "contain",
                      rounded: "sm",
                      cursor: "pointer",
                    })}
                    src={src()}
                    alt="PictureField"
                  />
                );
              }}
            />
          </Box>
        );
      }}
    />
  );
}
