import type { NoteMediaSrc } from "@repo/preload/ipc";
import { FishSymbolIcon, ZoomInIcon } from "lucide-solid";
import {
  createEffect,
  createSelector,
  createSignal,
  For,
  Suspense,
} from "solid-js";
import { Portal } from "solid-js/web";
import { css, cva } from "styled-system/css";
import { Box, Grid, HStack, Stack } from "styled-system/jsx";
import { Button } from "#/components/ui/button";
import { Dialog } from "#/components/ui/dialog";
import { useMediaUrlQuery } from "#/lib/query/general";
import { useNoteMediaQuery } from "#/lib/query/mining";
import { ImageWithFallback } from "./ImageWithFallback";
import { MediaSrcContextProvider, useMediaSrcContext } from "./MediaSrcContext";
import { useNoteContext } from "./NoteContext";
import { PictureWithZoom } from "./PictureWithZoom";

export function EditButton() {
  const note = useNoteContext();
  const noteMediaQuery = useNoteMediaQuery({ noteId: note.id });
  const availablePictures = () =>
    noteMediaQuery().data.filter((m) => m.type === "picture");

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
          <Dialog.Positioner p="4">
            <Dialog.Content w="full" maxW="5xl" p="8" maxH="[80svh]">
              <Suspense>
                <Stack gap="8">
                  <HStack justifyContent="center">
                    <MediaSrcContextProvider
                      value={createSignal<NoteMediaSrc>({
                        fileName: note.picture,
                        source: "anki" as const,
                      })}
                    >
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
                    </MediaSrcContextProvider>
                    <FishSymbolIcon
                      class={css({
                        h: "full",
                        w: "full",
                        maxW: "24",
                        color: "fg.subtle",
                      })}
                      strokeWidth="1"
                    />
                    <MediaSrcContextProvider
                      value={[selectedMedisSrc, setSelectedMediaSrc]}
                    >
                      <SelectedImage />
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
  const note = useNoteContext();
  const [mediaSrc] = useMediaSrcContext();
  const mediaUrlQuery = useMediaUrlQuery(
    () => mediaSrc().fileName,
    () => mediaSrc().source,
  );
  const src = () => mediaUrlQuery().data ?? "";
  createEffect(() => {});

  return (
    <PictureWithZoom
      src={src()}
      trigger={(triggerProps) => {
        return (
          <Box position="relative">
            <ImageWithFallback
              src={src()}
              height="56"
              image={(imageProps) => {
                return (
                  <img
                    {...triggerProps()}
                    {...imageProps()}
                    class={css({
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
  const note = useNoteContext();
  const [mediaSrc] = useMediaSrcContext();
  const mediaUrlQuery = useMediaUrlQuery(
    () => mediaSrc().fileName,
    () => mediaSrc().source,
  );
  const src = () => mediaUrlQuery().data ?? "";

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
            <ZoomInIcon
              {...triggerProps()}
              class={zoomIconCva({ size: "default" })}
            />
            <ImageWithFallback
              src={src()}
              height="56"
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
  const note = useNoteContext();
  const [mediaSrc] = useMediaSrcContext();
  const mediaUrlQuery = useMediaUrlQuery(
    () => mediaSrc().fileName,
    () => mediaSrc().source,
  );
  const src = () => mediaUrlQuery().data ?? "";

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
            <ZoomInIcon
              {...triggerProps()}
              class={zoomIconCva({ size: "sm" })}
            />
            <ImageWithFallback
              src={src()}
              height="28"
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
