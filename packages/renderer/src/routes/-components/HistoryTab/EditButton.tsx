import type { Media, MediaSrc } from "@repo/preload/ipc";
import { FishSymbolIcon, ZoomInIcon } from "lucide-solid";
import { createEffect, createSignal, For, onMount } from "solid-js";
import { Portal } from "solid-js/web";
import { css, cva } from "styled-system/css";
import { Box, Grid, HStack, Stack } from "styled-system/jsx";
import { Button } from "#/components/ui/button";
import { Dialog } from "#/components/ui/dialog";
import { mediaSrcQuery } from "#/lib/query/useMediaSrc";
import { getMediaUrl } from "#/lib/util";
import { ImageWithFallback } from "./ImageWithFallback";
import { MediaSrcContextProvider, useMediaSrcContext } from "./MediaSrcContext";
import { useNoteContext } from "./NoteContext";
import { PictureWithZoom } from "./PictureWithZoom";

export function EditButton() {
  const note = useNoteContext();
  const mediaSrc = mediaSrcQuery({ noteId: note.id });
  const [media, setMedia] = createSignal<Media>([]);
  const pictureMedia = () => mediaSrc.data.filter((m) => m.type === "picture");
  const sentenceAudioMedia = () =>
    media().find((m) => m.type === "sentenceAudio");

  const [selectedMedisSrc, setSelectedMediaSrc] = createSignal<MediaSrc>({
    fileName: note.picture,
    source: "anki",
  });

  onMount(async () => {
    const media = await ipcRenderer.invoke("mining:getNoteMedia", {
      noteId: note.id,
    });
    setMedia(media);
  });

  createEffect(() => {});

  return (
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
            <Stack gap="8">
              <HStack justifyContent="center">
                <MediaSrcContextProvider
                  value={createSignal<MediaSrc>({
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
                <For each={pictureMedia()}>
                  {(item) => {
                    const isSelected = () =>
                      selectedMedisSrc().fileName === item.fileName &&
                      selectedMedisSrc().source === "storage";
                    return (
                      <MediaSrcContextProvider
                        value={createSignal<MediaSrc>({
                          fileName: item.fileName,
                          source: "storage",
                        })}
                      >
                        <AvailableImage
                          isSelected={isSelected()}
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
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
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
  const src = () => getMediaUrl(mediaSrc().fileName, mediaSrc().source);

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
  const src = getMediaUrl(mediaSrc().fileName, mediaSrc().source);

  return (
    <PictureWithZoom
      src={src}
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
              src={src}
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
                    src={src}
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
  const src = getMediaUrl(mediaSrc().fileName, mediaSrc().source);

  return (
    <PictureWithZoom
      src={src}
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
              src={src}
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
                    src={src}
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
