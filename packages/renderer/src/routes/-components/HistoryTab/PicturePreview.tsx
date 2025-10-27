import { createEffect, createSignal, Show, Suspense } from "solid-js";
import { Portal } from "solid-js/web";
import { css } from "styled-system/css";
import { HStack, Stack } from "styled-system/jsx";
import { Dialog } from "#/components/ui/dialog";
import { Spinner } from "#/components/ui/spinner";
import { Switch as Toggle } from "#/components/ui/switch";
import { GeneralQuery } from "#/lib/query/general";
import { MiningMutation } from "#/lib/query/mining";
import { appToaster } from "../AppToaster";
import { srcSet } from "./_util";
import { useNoteContext } from "./Context";

export function PicturePreview() {
  const { HttpServerUrlQuery } = GeneralQuery;
  const note = useNoteContext();
  const [nsfw, setNsfw] = createSignal(note.nsfw);
  const mediaUrlQuery = HttpServerUrlQuery.mediaUrl.use(
    () => note.picture,
    () => "anki",
  );
  const pictureSrc = () => mediaUrlQuery.data ?? "";
  const updateNoteMutation = MiningMutation.AnkiMutation.updateNote();

  createEffect(() => {
    setNsfw(note.nsfw);
  });

  function toggleNsfw(checked: boolean) {
    setNsfw(checked);
    const nsfw_ = nsfw();
    appToaster.promise(
      updateNoteMutation.mutateAsync(
        {
          noteId: note.id,
          nsfw: nsfw_,
        },
        {
          onSuccess: () => {},
          onError: () => {
            setNsfw((prev) => !prev);
          },
        },
      ),
      {
        loading: {
          title: "Updating note NSFW tag...",
          description: `${note.expression}`,
        },
        error: {
          title: "Failed to update note NSFW tag",
          description: note.expression,
        },
        success: {
          title: "Note NSFW tag updated",
          description: `${note.expression}`,
        },
      },
    );
  }

  return (
    <Suspense>
      <Dialog.Root lazyMount>
        <Dialog.Trigger
          asChild={(triggerProps) => {
            const [loaded, setLoaded] = createSignal(srcSet.has(pictureSrc()));
            const [error, setError] = createSignal(false);
            return (
              <>
                <Show when={!error() && pictureSrc()}>
                  <img
                    {...triggerProps()}
                    class={css({
                      height: "48",
                      objectFit: "contain",
                      rounded: "md",
                      cursor: "pointer",
                      filter: nsfw() ? "[blur(16px) brightness(0.5)]" : "auto",
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
                  disabled={updateNoteMutation.isPending}
                  checked={nsfw()}
                  onCheckedChange={(e) => {
                    toggleNsfw(e.checked);
                  }}
                >
                  NSFW
                </Toggle>
              </HStack>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </Suspense>
  );
}
