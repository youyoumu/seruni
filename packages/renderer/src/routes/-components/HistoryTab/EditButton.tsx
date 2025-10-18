import {
  type AnkiHistory,
  type Media,
  zStorageUrlPath,
} from "@repo/preload/ipc";
import { createEffect, createSignal, For, onMount, Show } from "solid-js";
import { Portal } from "solid-js/web";
import { css } from "styled-system/css";
import { Grid, Stack } from "styled-system/jsx";
import { Button } from "#/components/ui/button";
import { Dialog } from "#/components/ui/dialog";
import { Spinner } from "#/components/ui/spinner";
import { store } from "#/lib/store";
import { history, srcSet } from "./_util";

export function EditButton(props: { noteId: number }) {
  const note = () =>
    history.find((item) => item.id === props.noteId) as AnkiHistory[number];

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
          <Dialog.Content w="full" maxW="5xl" p="4" maxH="[80svh]">
            <Stack>
              <Grid
                gridTemplateColumns="repeat(auto-fit, minmax(160px, 1fr))"
                gap="4"
              >
                <For each={pictureMedia()}>
                  {(item) => {
                    const pictureSrc = () =>
                      `${store.general.httpServerUrl}${zStorageUrlPath.value}${item.fileName}`;

                    return <PictureThumbnail src={pictureSrc()} />;
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

export function PictureThumbnail(props: { src: string }) {
  return (
    <Dialog.Root>
      <Dialog.Trigger
        asChild={(triggerProps) => {
          const [loaded, setLoaded] = createSignal(srcSet.has(props.src));
          const [error, setError] = createSignal(false);
          return (
            <>
              <Show when={!error()}>
                <img
                  {...triggerProps()}
                  class={css({
                    height: "28",
                    objectFit: "contain",
                    rounded: "sm",
                    cursor: "pointer",
                  })}
                  style={{
                    display: loaded() ? "block" : "none",
                  }}
                  src={props.src}
                  alt="PictureField"
                  onLoad={() => {
                    setLoaded(true);
                    srcSet.add(props.src);
                  }}
                  onError={() => setError(true)}
                />
              </Show>
              <Show when={!loaded() && !error()}>
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
