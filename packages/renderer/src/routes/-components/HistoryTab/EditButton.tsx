import type { AnkiHistory, Media } from "@repo/preload/ipc";
import {
  ArrowRightFromLineIcon,
  FullscreenIcon,
  PawPrintIcon,
  ZoomInIcon,
} from "lucide-solid";
import {
  createEffect,
  createSignal,
  For,
  type JSX,
  onMount,
  type ParentProps,
  Show,
} from "solid-js";
import { Portal } from "solid-js/web";
import { css, cva } from "styled-system/css";
import { Box, Grid, HStack, Stack } from "styled-system/jsx";
import { Button } from "#/components/ui/button";
import { Dialog } from "#/components/ui/dialog";
import { Spinner } from "#/components/ui/spinner";
import { getMediaUrl } from "#/lib/util";
import { history, srcSet } from "./_util";

export function EditButton(props: { noteId: number }) {
  const note = () =>
    history.find((item) => item.id === props.noteId) as AnkiHistory[number];
  const [media, setMedia] = createSignal<Media>([]);
  const pictureMedia = () => media().filter((m) => m.type === "picture");
  const sentenceAudioMedia = () =>
    media().find((m) => m.type === "sentenceAudio");
  const pictureSrc = () => getMediaUrl(note().picture, "anki");

  const [selectedImage, setSelectedImage] = createSignal<{
    fileName: string | undefined;
    source: "storage" | "anki";
  }>({
    fileName: note().picture,
    source: "anki",
  });
  const selectedImageSrc = () =>
    selectedImage().fileName
      ? selectedImage().source === "anki"
        ? getMediaUrl(selectedImage().fileName ?? "", "anki")
        : getMediaUrl(selectedImage().fileName ?? "", "storage")
      : "";

  onMount(async () => {
    const media = await ipcRenderer.invoke("mining:getNoteMedia", {
      noteId: note().id,
    });
    setMedia(media);
  });

  createEffect(() => {
    console.log("DEBUG[753]: selectedImage=", selectedImage());
  });

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
                <CurrentImage
                  isSelected={
                    selectedImage().fileName === note().picture &&
                    selectedImage().source === "anki"
                  }
                  src={pictureSrc()}
                  onClick={() => {
                    setSelectedImage({
                      fileName: note().picture,
                      source: "anki",
                    });
                  }}
                />
                <ArrowRightFromLineIcon
                  class={css({
                    h: "full",
                    w: "full",
                    maxW: "24",
                    color: "fg.subtle",
                  })}
                  strokeWidth="1"
                />
                <SelectedImage
                  src={selectedImageSrc()}
                  onClick={() => {
                    //TODO: crop pop up
                  }}
                />
              </HStack>
              <Grid
                gridTemplateColumns="repeat(auto-fit, minmax(160px, 1fr))"
                gap="4"
              >
                <For each={pictureMedia()}>
                  {(item) => {
                    const pictureSrc = () =>
                      getMediaUrl(item.fileName, "storage");
                    const isSelected = () =>
                      selectedImage().fileName === item.fileName &&
                      selectedImage().source === "storage";
                    return (
                      <AvailableImage
                        isSelected={isSelected()}
                        src={pictureSrc()}
                        onClick={() => {
                          setSelectedImage({
                            fileName: item.fileName,
                            source: "storage",
                          });
                        }}
                      />
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
    cursor: "pointer",
    rounded: "sm",
    bg: "bg.default/75",
    w: "6",
    h: "6",
    p: "0.5",
    position: "absolute",
    top: "2",
    right: "2",
    strokeWidth: "1.5",
  },
  variants: {
    size: {
      default: {
        w: "8",
        h: "8",
      },
      sm: {
        top: "1",
        right: "1",
        w: "6",
        h: "6",
      },
    },
  },
});

function SelectedImage(props: { src: string; onClick: () => void }) {
  const pictureSrc = () => props.src;
  return (
    <PictureWithZoom
      src={pictureSrc()}
      trigger={(triggerProps) => {
        return (
          <Box position="relative">
            <FullscreenIcon
              {...triggerProps()}
              class={zoomIconCva({ size: "default" })}
            />
            <ImageWithFallback
              src={pictureSrc()}
              height="56"
              image={(imageProps) => {
                return (
                  <img
                    {...imageProps()}
                    onClick={props.onClick}
                    class={css({
                      width: "full",
                      height: "full",
                      objectFit: "contain",
                      rounded: "sm",
                      cursor: "pointer",
                    })}
                    src={pictureSrc()}
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

function CurrentImage(props: {
  src: string;
  onClick: () => void;
  isSelected: boolean;
}) {
  const pictureSrc = () => props.src;
  return (
    <PictureWithZoom
      src={pictureSrc()}
      trigger={(triggerProps) => {
        return (
          <Box position="relative">
            <FullscreenIcon
              {...triggerProps()}
              class={zoomIconCva({ size: "default" })}
            />
            <ImageWithFallback
              src={pictureSrc()}
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
                    src={pictureSrc()}
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

function AvailableImage(props: {
  src: string;
  onClick: () => void;
  isSelected: boolean;
}) {
  const pictureSrc = () => props.src;
  return (
    <PictureWithZoom
      src={pictureSrc()}
      trigger={(triggerProps) => {
        return (
          <Box position="relative">
            <FullscreenIcon
              {...triggerProps()}
              class={zoomIconCva({ size: "sm" })}
            />
            <ImageWithFallback
              src={pictureSrc()}
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
                    src={pictureSrc()}
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
function ImageWithFallback(props: {
  src: string;
  image: (
    props: () => ParentProps<JSX.ImgHTMLAttributes<HTMLImageElement>>,
  ) => JSX.Element;
  height: string;
}) {
  const [loaded, setLoaded] = createSignal(srcSet.has(props.src));
  const [error, setError] = createSignal(false);
  return (
    <>
      <Show when={!error()}>
        {props.image(() => ({
          style: {
            display: loaded() ? "block" : "none",
          },
          onLoad: () => {
            setLoaded(true);
            srcSet.add(props.src);
          },
          onError: () => {
            setError(true);
          },
        }))}
      </Show>
      <Show when={!loaded() && !error()}>
        <Stack
          class={css({
            rounded: "sm",
            borderColor: "border.default",
            borderWidth: "thin",
            aspectRatio: "16 / 9",
            alignItems: "center",
            justifyContent: "center",
            height: `[${props.height}]`,
            width: "full",
          })}
        >
          <Spinner size="lg" />
        </Stack>
      </Show>
      <Show when={loaded() && error()}>
        <Stack
          class={css({
            rounded: "sm",
            borderColor: "border.default",
            borderWidth: "thin",
            aspectRatio: "16 / 9",
            alignItems: "center",
            justifyContent: "center",
            height: `[${props.height}]`,
            width: "full",
          })}
        ></Stack>
      </Show>
    </>
  );
}

export function PictureWithZoom(props: {
  src: string;
  trigger: (props: () => ParentProps) => JSX.Element;
}) {
  return (
    <Dialog.Root>
      <Dialog.Trigger
        asChild={(triggerProps) => {
          return props.trigger(triggerProps);
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
                  src={props.src}
                  alt="PictureField"
                />
              )}
            />
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
