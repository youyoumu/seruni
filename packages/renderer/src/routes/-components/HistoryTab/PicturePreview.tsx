import {
  type AnkiHistory,
  zAnkiCollectionMediaUrlPath,
} from "@repo/preload/ipc";
import { createSignal, Show } from "solid-js";
import { Portal } from "solid-js/web";
import { css } from "styled-system/css";
import { HStack, Stack } from "styled-system/jsx";
import { Dialog } from "#/components/ui/dialog";
import { Spinner } from "#/components/ui/spinner";
import { Switch as Toggle } from "#/components/ui/switch";
import { store } from "#/lib/store";
import { appToaster } from "../AppToaster";
import { history, nsfwUpdateLock, srcSet } from "./_util";

export function PicturePreview(props: { noteId: number }) {
  const note = () =>
    history.find((item) => item.id === props.noteId) as AnkiHistory[number];
  if (!note()) return null;
  //TODO: modify via context
  const [nsfw, setNsfw] = createSignal(note().nsfw);
  const pictureSrc = () =>
    `${store.general.httpServerUrl}${zAnkiCollectionMediaUrlPath.value}${note().picture}`;

  return (
    <Dialog.Root>
      <Dialog.Trigger
        asChild={(triggerProps) => {
          const [loaded, setLoaded] = createSignal(srcSet.has(pictureSrc()));
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
                    filter: nsfw() ? "[blur(12px) brightness(0.5)]" : "auto",
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
  );
}
