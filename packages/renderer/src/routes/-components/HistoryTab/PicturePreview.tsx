import { css } from "styled-system/css";
import { Box } from "styled-system/jsx";
import { Switch as Toggle } from "#/components/ui/switch";
import { GeneralQuery } from "#/lib/query/queryGeneral";
import { MiningMutation } from "#/lib/query/queryMining";
import { appToaster } from "../AppToaster";
import { NoteMediaSrcContextProvider, useNoteContext } from "./Context";
import { ImageWithFallback, PictureWithZoom } from "./Picture";

export function PicturePreview(props: { readOnly?: boolean }) {
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

  const [error, setError] = createSignal(false);

  return (
    <Suspense>
      <NoteMediaSrcContextProvider
        value={{
          fileName: () => note.picture,
          source: () => "anki",
        }}
      >
        <PictureWithZoom
          hideButtons
          trigger={(triggerProps) => {
            return (
              <Box h="48" aspectRatio={error() ? "16 / 9" : undefined}>
                <ImageWithFallback
                  onErrorChange={setError}
                  src={pictureSrc()}
                  image={(imageProps) => {
                    return (
                      <img
                        {...triggerProps()}
                        {...imageProps()}
                        class={css({
                          h: "full",
                          objectFit: "contain",
                          rounded: "md",
                          cursor: "pointer",
                          filter: nsfw()
                            ? "[blur(16px) brightness(0.5)]"
                            : "auto",
                          _hover: {
                            filter: "[blur(0px) brightness(1)]",
                          },
                          transition: "[filter 0.2s ease-in-out]",
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
          extraButtons={
            <Show when={!props.readOnly}>
              <Toggle
                disabled={updateNoteMutation.isPending}
                checked={nsfw()}
                onCheckedChange={(e) => {
                  toggleNsfw(e.checked);
                }}
              >
                NSFW
              </Toggle>
            </Show>
          }
        />
      </NoteMediaSrcContextProvider>
    </Suspense>
  );
}
