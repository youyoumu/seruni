import {
  type AnkiHistory,
  type Media,
  type SelectionData,
  zSelectionData,
} from "@repo/preload/ipc";
import Cropper from "cropperjs";
import { ArrowRightFromLineIcon, FullscreenIcon } from "lucide-solid";
import {
  createEffect,
  createSignal,
  For,
  type JSX,
  onCleanup,
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
                  //TODO: crop pop up
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

function SelectedImage(props: { src: string }) {
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
                  <PictureWithCropper
                    src={pictureSrc()}
                    trigger={(triggerProps) => {
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
                          src={pictureSrc()}
                          alt="PictureField"
                        />
                      );
                    }}
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
            //TODO: this doesn't work
            height: `[${props.height}]`,
            width: "full",
          })}
        ></Stack>
      </Show>
    </>
  );
}

function CropperImage(props: { src: string; editing: boolean }) {
  const [selectionData, setSelectionData] = createSignal<SelectionData>({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });
  const [naturalSize, setNaturalSize] = createSignal<{
    width: number;
    height: number;
  }>({ width: 0, height: 0 });
  const [isPreselect, setIsPreselect] = createSignal(true);
  const image = new Image();
  image.alt = "Picture";
  image.src = props.src;
  let cropperContainer: HTMLDivElement | undefined;
  let cropper: Cropper | undefined;

  function inSelection(selection: SelectionData, maxSelection: SelectionData) {
    return (
      selection.x >= maxSelection.x &&
      selection.y >= maxSelection.y &&
      selection.x + selection.width <= maxSelection.x + maxSelection.width &&
      selection.y + selection.height <= maxSelection.y + maxSelection.height
    );
  }

  const abortController = new AbortController();

  createEffect(() => {
    image.src = props.src;
    cropper = new Cropper(image, {
      container: cropperContainer,
    });

    const listener1 = (e: Event) => {
      const image = e.target as HTMLImageElement;
      setNaturalSize({
        width: image.naturalWidth,
        height: image.naturalHeight,
      });
    };
    image.addEventListener("load", listener1);

    const centerImage = () => {
      cropper?.getCropperImage()?.$center("contain");
      if (props.editing && isPreselect()) {
        const cropperSelection = cropper?.getCropperSelection();
        const w = image.naturalWidth;
        const h = image.naturalHeight;

        // target crop size (50%)
        const cropWidth = w * 0.5;
        const cropHeight = h * 0.5;

        // centered position
        const cropX = (w - cropWidth) / 2;
        const cropY = (h - cropHeight) / 2;

        cropperSelection?.$change(cropX, cropY, cropWidth, cropHeight);
        setIsPreselect(false);
      }
    };
    const observer = new ResizeObserver(centerImage);
    const cropperImage = cropper.getCropperImage();
    if (cropperImage) observer.observe(cropperImage);
    window.addEventListener("resize", centerImage);

    const listener2 = (e: Event) => {
      cropper?.getCropperImage()?.$center("contain");
      const parsed = zSelectionData.safeParse(
        (e as Event & { detail: unknown }).detail,
      );
      if (parsed.success) {
        const cropperImageRect = cropper
          ?.getCropperImage()
          ?.getBoundingClientRect();
        const maxSelection: SelectionData = {
          x: 0,
          y: 0,
          width: cropperImageRect?.width ?? 0,
          height: cropperImageRect?.height ?? 0,
        };
        if (!inSelection(parsed.data, maxSelection)) {
          e.preventDefault();
        } else {
          setSelectionData(parsed.data);
        }
      }
    };
    cropper.getCropperSelection()?.addEventListener("change", listener2);

    abortController.signal.addEventListener("abort", () => {
      image.removeEventListener("load", listener1);
      cropper?.getCropperSelection()?.removeEventListener("change", listener2);
      observer.disconnect();
      window.removeEventListener("resize", centerImage);
    });

    onCleanup(() => {
      cropper?.getCropperCanvas()?.remove();
      abortController.abort();
    });
  });

  return (
    <div
      ref={cropperContainer}
      class={css({
        maxW: "full",
        rounded: "md",
        shadow: "md",
        "& > cropper-canvas": {
          height: "full",
          width: "full",
        },
        "& > cropper-canvas > cropper-image": {
          height: "full",
          width: "full",
        },
      })}
      style={{
        width: `${naturalSize().width}px`,
        "aspect-ratio": `${naturalSize().width} / ${naturalSize().height}`,
        height: "auto",
      }}
    ></div>
  );
}

export function PictureWithCropper(props: {
  src: string;
  trigger: (props: () => ParentProps) => JSX.Element;
}) {
  const [selectionData, setSelectionData] = createSignal<SelectionData>({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });
  const [naturalSize, setNaturalSize] = createSignal<{
    width: number;
    height: number;
  }>({ width: 0, height: 0 });
  const image = new Image();
  image.alt = "Picture";
  image.src = props.src;
  let cropperContainer: HTMLDivElement | undefined;
  let cropper: Cropper | undefined;

  function inSelection(selection: SelectionData, maxSelection: SelectionData) {
    return (
      selection.x >= maxSelection.x &&
      selection.y >= maxSelection.y &&
      selection.x + selection.width <= maxSelection.x + maxSelection.width &&
      selection.y + selection.height <= maxSelection.y + maxSelection.height
    );
  }

  const abortController = new AbortController();

  createEffect(() => {
    image.src = props.src;
    cropper = new Cropper(image, {
      container: cropperContainer,
    });

    const listener1 = (e: Event) => {
      const image = e.target as HTMLImageElement;
      setNaturalSize({
        width: image.naturalWidth,
        height: image.naturalHeight,
      });
    };
    image.addEventListener("load", listener1);

    const centerImage = () => {
      cropper?.getCropperImage()?.$center("contain");
    };
    const observer = new ResizeObserver(centerImage);
    const cropperImage = cropper.getCropperImage();
    if (cropperImage) observer.observe(cropperImage);
    window.addEventListener("resize", centerImage);

    const listener2 = (e: Event) => {
      cropper?.getCropperImage()?.$center("contain");
      const parsed = zSelectionData.safeParse(
        (e as Event & { detail: unknown }).detail,
      );
      if (parsed.success) {
        const cropperImageRect = cropper
          ?.getCropperImage()
          ?.getBoundingClientRect();
        const maxSelection: SelectionData = {
          x: 0,
          y: 0,
          width: cropperImageRect?.width ?? 0,
          height: cropperImageRect?.height ?? 0,
        };
        if (!inSelection(parsed.data, maxSelection)) {
          e.preventDefault();
        } else {
          setSelectionData(parsed.data);
        }
      }
    };
    cropper.getCropperSelection()?.addEventListener("change", listener2);
    abortController.signal.addEventListener("abort", () => {
      image.removeEventListener("load", listener1);
      cropper?.getCropperSelection()?.removeEventListener("change", listener2);
      observer.disconnect();
      window.removeEventListener("resize", centerImage);
    });

    onCleanup(() => {
      cropper?.getCropperCanvas()?.remove();
      abortController.abort();
    });
  });

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
                <Box maxW="8xl">
                  <div
                    ref={cropperContainer}
                    class={css({
                      maxW: "full",
                      rounded: "md",
                      shadow: "md",
                      "& > cropper-canvas": {
                        height: "full",
                        width: "full",
                      },
                      "& > cropper-canvas > cropper-image": {
                        height: "full",
                        width: "full",
                      },
                    })}
                    style={{
                      width: `${naturalSize().width}px`,
                      "aspect-ratio": `${naturalSize().width} / ${naturalSize().height}`,
                      height: "auto",
                    }}
                  ></div>
                </Box>
              )}
            />
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}

export function PictureWithZoom(props: {
  src: string;
  trigger: (props: () => ParentProps) => JSX.Element;
}) {
  const [editing, setEditing] = createSignal(false);

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
                <Stack>
                  <Show when={!editing()}>
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
                  </Show>

                  <Box maxW="8xl" hidden={!editing()}>
                    <CropperImage src={props.src} editing={editing()} />
                  </Box>

                  <HStack justifyContent="end" px="8">
                    <Button
                      {...closeTriggerProps()}
                      opacity="0"
                      flex="1"
                      cursor="default"
                    >
                      ""
                    </Button>
                    <Show when={editing()}>
                      <Button
                        onClick={() => {
                          setEditing(false);
                        }}
                      >
                        Cancel
                      </Button>
                      <Button onClick={() => {}}>Save</Button>
                    </Show>
                    <Show when={!editing()}>
                      <Button
                        onClick={() => {
                          setEditing(true);
                        }}
                      >
                        Crop
                      </Button>
                    </Show>
                  </HStack>
                </Stack>
              )}
            />
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
