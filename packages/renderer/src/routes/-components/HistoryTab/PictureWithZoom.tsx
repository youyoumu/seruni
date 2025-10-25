import type { SelectionData } from "@repo/preload/ipc";
import { useQueryClient } from "@tanstack/solid-query";
import { CropIcon } from "lucide-solid";
import { createSignal, type JSX, type ParentProps, Show } from "solid-js";
import { Portal } from "solid-js/web";
import { css } from "styled-system/css";
import { Box, HStack, Stack } from "styled-system/jsx";
import { Button } from "#/components/ui/button";
import { Dialog } from "#/components/ui/dialog";
import { MiningMutation } from "#/lib/query/mining";
import { appToaster } from "../AppToaster";
import { useMediaSrcContext } from "./MediaSrcContext";
import { useNoteContext } from "./NoteContext";
import { PictureCropper } from "./PictureCropper";

export function PictureWithZoom(props: {
  src: string;
  trigger: (props: () => ParentProps) => JSX.Element;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = createSignal(false);
  const note = useNoteContext();
  const [mediaSrc] = useMediaSrcContext();
  const [selectionData, setSelectionData] = createSignal<SelectionData>({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });
  const [editing, setEditing] = createSignal(false);
  const cropPictureMutation = MiningMutation.AnkiMutation.cropPicture();

  function cropPicture() {
    appToaster.promise(
      cropPictureMutation.mutateAsync(
        {
          noteId: note.id,
          mediaSrc: {
            fileName: mediaSrc().fileName,
            source: mediaSrc().source,
          },
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
          description: `${mediaSrc().fileName}`,
        },
        error: {
          title: "Failed to crop picture",
          description: `${mediaSrc().fileName}`,
        },
        success: {
          title: "Picture cropped",
          description: `${mediaSrc().fileName}`,
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
                        src={props.src}
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
                        src={props.src}
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
                    <Show when={editing()}>
                      <Button
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
