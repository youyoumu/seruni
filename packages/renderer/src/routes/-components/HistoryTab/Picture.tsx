import type { SelectionData } from "@repo/preload/ipc";
import { CropIcon, RatIcon, Trash2Icon, ZoomInIcon } from "lucide-solid";
import type { JSX, ParentProps } from "solid-js";
import { css, cva } from "styled-system/css";
import { Box, HStack, Stack } from "styled-system/jsx";
import { Flip } from "#/components/Flip";
import { Button } from "#/components/ui/button";
import { Dialog } from "#/components/ui/dialog";
import { Icon } from "#/components/ui/icon";
import { Spinner } from "#/components/ui/spinner";
import { GeneralQuery } from "#/lib/query/general";
import { MiningMutation } from "#/lib/query/mining";
import { appToaster } from "../AppToaster";
import { srcSet } from "./_util";
import {
  useNoteContext,
  useNoteFormContext,
  useNoteMediaSrcContext,
} from "./Context";
import { PictureCropper } from "./PictureCropper";

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

export function PictureMenu(props: {
  onClick: () => void;
  isSelected: boolean;
  zoom?: boolean;
  delete?: boolean;
}) {
  const [noteForm, setNoteForm] = useNoteFormContext();
  const noteMediaSrc = useNoteMediaSrcContext();
  const mediaUrlQuery = GeneralQuery.HttpServerUrlQuery.mediaUrl.use(
    () => noteMediaSrc.fileName(),
    () => noteMediaSrc.source(),
  );
  const src = () =>
    noteMediaSrc.fileName() ? (mediaUrlQuery.data ?? "") : undefined;
  const [error, setError] = createSignal(false);

  const [showDeleteConfirm, setShowDeleteConfirm] = createSignal(false);
  const deleteNoteMediaMutation =
    MiningMutation.NoteMediaMutation.deleteNoteMedia();

  function deletePicture() {
    const fileName = noteMediaSrc.fileName();
    if (!fileName) return;
    if (fileName === noteForm.picture) {
      setNoteForm("picture", undefined);
    }
    appToaster.promise(deleteNoteMediaMutation.mutateAsync({ fileName }), {
      loading: {
        title: "Deleting picture...",
        description: `${fileName}`,
      },
      error: {
        title: "Failed to delete picture",
        description: `${fileName}`,
      },
      success: {
        title: "Picture deleted",
        description: `${fileName}`,
      },
    });
  }

  return (
    <PictureWithZoom
      extraButtons={
        props.delete ? (
          <Button
            loading={deleteNoteMediaMutation.isPending}
            colorPalette="red"
            onClick={() => {
              if (!showDeleteConfirm()) {
                setShowDeleteConfirm(true);
              } else {
                deletePicture();
              }
            }}
          >
            <Show when={showDeleteConfirm()}>Confirm</Show>
            <Trash2Icon></Trash2Icon>
          </Button>
        ) : undefined
      }
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
            <Show when={!error() && props.zoom !== false}>
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

export function ImageWithFallback(props: {
  src: string | undefined;
  image: (
    props: () => ParentProps<JSX.ImgHTMLAttributes<HTMLImageElement>>,
  ) => JSX.Element;
  onErrorChange?: (error: boolean) => void;
}) {
  const [loaded, setLoaded] = createSignal(srcSet.has(props.src));
  const [error, setError] = createSignal(false);
  createEffect(() => {
    if (props.src) {
      setError(false);
    } else {
      setError(true);
    }
  });
  createEffect(() => {
    props.onErrorChange?.(error());
  });

  return (
    <Switch>
      <Match when={!error() && !!props.src}>
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
      </Match>
      <Match when={!loaded() && !error() && !!props.src}>
        <Stack
          class={css({
            rounded: "sm",
            borderColor: "border.default",
            borderWidth: "thin",
            aspectRatio: "16 / 9",
            alignItems: "center",
            justifyContent: "center",
            width: "full",
          })}
        >
          <Spinner size="lg" />
        </Stack>
      </Match>
      <Match when={error() || !props.src}>
        <Stack
          class={css({
            rounded: "sm",
            borderColor: "border.default",
            borderWidth: "thin",
            aspectRatio: "16 / 9",
            alignItems: "center",
            justifyContent: "center",
            height: "auto",
            width: "full",
          })}
        >
          <Flip>
            <Icon
              color="fg.muted"
              width="12"
              height="12"
              strokeWidth="1"
              asChild={(iconProps) => <RatIcon {...iconProps()} />}
            />
          </Flip>
        </Stack>
      </Match>
    </Switch>
  );
}

export function PictureWithZoom(props: {
  trigger: (props: () => ParentProps) => JSX.Element;
  hideButtons?: boolean;
  extraButtons?: JSX.Element;
}) {
  const [open, setOpen] = createSignal(false);
  const note = useNoteContext();
  const noteMediaSrc = useNoteMediaSrcContext();
  const mediaSrcQuery = GeneralQuery.HttpServerUrlQuery.mediaUrl.use(
    () => noteMediaSrc.fileName(),
    () => noteMediaSrc.source(),
  );
  const src = () => mediaSrcQuery.data ?? "";

  const [editing, setEditing] = createSignal(false);
  const [selectionData, setSelectionData] = createSignal<SelectionData>({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });
  const cropPictureMutation = MiningMutation.AnkiMutation.cropPicture();

  function cropPicture() {
    const fileName = noteMediaSrc.fileName();
    const source = noteMediaSrc.source();
    if (!fileName || !source) return;
    appToaster.promise(
      cropPictureMutation.mutateAsync(
        {
          noteId: note.id,
          mediaSrc: { fileName, source },
          selectionData: selectionData(),
        },
        {
          onSuccess: () => {
            setEditing(false);
            setOpen(false);
          },
        },
      ),
      {
        loading: {
          title: "Cropping picture...",
          description: `${fileName}`,
        },
        error: {
          title: "Failed to crop picture",
          description: `${fileName}`,
        },
        success: {
          title: "Picture cropped",
          description: `${fileName}`,
        },
      },
    );
  }

  return (
    <Dialog.Root lazyMount open={open()} onOpenChange={(e) => setOpen(e.open)}>
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
                    <Box
                      borderWidth="thin"
                      borderColor="border.default"
                      bg="bg.subtle"
                      rounded="sm"
                      overflow="hidden"
                    >
                      <img
                        {...closeTriggerProps()}
                        class={css({
                          w: "full",
                          maxW: "8xl",
                          objectFit: "contain",
                          shadow: "md",
                        })}
                        src={src()}
                        alt="PictureField"
                      />
                    </Box>
                  </Show>

                  <Box maxW="8xl" hidden={!editing()}>
                    <Box
                      borderWidth="thin"
                      borderColor="border.default"
                      bg="bg.subtle"
                      rounded="sm"
                      overflow="hidden"
                    >
                      <PictureCropper
                        src={src()}
                        editing={editing()}
                        onSelectionChange={(details) => {
                          setSelectionData(details.selectionData);
                        }}
                      />
                    </Box>
                  </Box>

                  <HStack justifyContent="end">
                    <Button
                      {...closeTriggerProps()}
                      opacity="0"
                      flex="1"
                      cursor="default"
                    >
                      ""
                    </Button>
                    {props.extraButtons}

                    <Show when={props.hideButtons !== true}>
                      <Show when={editing()}>
                        <Button
                          variant="subtle"
                          onClick={() => {
                            setEditing(false);
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          loading={cropPictureMutation.isPending}
                          onClick={() => {
                            cropPicture();
                          }}
                        >
                          Copy and Save
                        </Button>
                      </Show>
                      <Show when={!editing()}>
                        <Button
                          onClick={() => {
                            setEditing(true);
                          }}
                        >
                          Crop
                          <CropIcon />
                        </Button>
                      </Show>
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
