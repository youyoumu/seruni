import { createIntersectionObserver } from "@solid-primitives/intersection-observer";
import { ArrowRightIcon, UndoIcon } from "lucide-solid";
import type { JSX, ParentProps } from "solid-js";
import { css } from "styled-system/css";
import { Box, Grid, HStack, Stack } from "styled-system/jsx";
import { Button } from "#/components/ui/button";
import { Code } from "#/components/ui/code";
import { Dialog } from "#/components/ui/dialog";
import { Heading } from "#/components/ui/heading";
import { IconButton } from "#/components/ui/icon-button";
import { MiningMutation, MiningQuery } from "#/lib/query/mining";
import { SettingsQuery } from "#/lib/query/settings";
import { appToaster } from "../AppToaster";
import { AudioWaveMenu } from "./AudioWave";
import {
  type NoteForm,
  NoteFormContextProvider,
  NoteMediaSrcContextProvider,
  useNoteContext,
  useNoteFormContext,
} from "./Context";
import { PictureMenu } from "./Picture";
export function EditButton() {
  const [open, setOpen] = createSignal(false);
  const [lazy, setLazy] = createSignal(true);
  const { NoteMediaQuery } = MiningQuery;
  const note = useNoteContext();
  const noteMediaQuery = NoteMediaQuery.one.use({ noteId: note.id });
  const availablePictures = () => {
    const pictures = noteMediaQuery.data.filter((m) => m.type === "picture");
    if (pictures.length === 1) {
      pictures.push({
        fileName: "",
        type: "picture",
        vadData: null,
      });
    }
    return pictures;
  };
  const availableSentenceAudios = () =>
    noteMediaQuery.data.filter((m) => m.type === "sentenceAudio");

  const [noteForm, setNoteForm] = createStore<NoteForm>({
    picture: undefined,
    sentenceAudio: undefined,
  });

  const isPictureSelected = createSelector(
    () => noteForm.picture,
    (a, b) => {
      return a === b;
    },
  );
  const isSentenceAudioSelected = createSelector(
    () => noteForm.sentenceAudio,
    (a, b) => {
      return a === b;
    },
  );

  let triggerRef!: HTMLDivElement;

  createIntersectionObserver(
    () => [triggerRef],
    (entries) => {
      if (entries[0]?.isIntersecting && lazy()) {
        setLazy(false);
      }
    },
  );

  return (
    <NoteFormContextProvider value={[noteForm, setNoteForm]}>
      <Dialog.Root
        lazyMount={lazy()}
        open={open()}
        onOpenChange={(e) => {
          setOpen(e.open);
          if (!e.open) {
            setNoteForm("picture", undefined);
            setNoteForm("sentenceAudio", undefined);
          }
        }}
      >
        <Dialog.Trigger
          asChild={(triggerProps) => {
            return (
              <Button ref={triggerRef} size="sm" {...triggerProps()}>
                Edit
              </Button>
            );
          }}
        />
        <Dialog.Backdrop />
        <Suspense>
          <Portal mount={document.querySelector("#app") ?? document.body}>
            <Dialog.Positioner p="4">
              <Dialog.Content w="full" maxW="5xl" bg="bg.canvas">
                <Stack
                  p="8"
                  gap="8"
                  overflow="auto"
                  class="custom-scrollbar"
                  style={{
                    "max-height": "calc(90vh - 110px)",
                  }}
                >
                  <HStack>
                    <Heading size="2xl">Picture</Heading>
                  </HStack>
                  <HStack justifyContent="center" maxH="64">
                    <Box flex="1" bg="bg.subtle" rounded="sm">
                      <NoteMediaSrcContextProvider
                        value={{
                          fileName: () => note.picture,
                          source: () => "anki",
                        }}
                      >
                        <PictureMenu
                          isSelected={false}
                          onClick={() => {
                            setNoteForm("picture", undefined);
                          }}
                        />
                      </NoteMediaSrcContextProvider>
                    </Box>
                    <Box flexBasis="24">
                      <ArrowRightIcon
                        class={css({
                          h: "full",
                          w: "full",
                          maxW: "24",
                          color: "fg.subtle",
                        })}
                        strokeWidth="1"
                      />
                    </Box>
                    <Box flex="1" bg="bg.subtle" rounded="sm">
                      <NoteMediaSrcContextProvider
                        value={{
                          fileName: () => noteForm.picture,
                          source: () => "storage",
                        }}
                      >
                        <PictureMenu isSelected={false} onClick={() => {}} />
                      </NoteMediaSrcContextProvider>
                    </Box>
                  </HStack>
                  <Grid
                    gridTemplateColumns="repeat(auto-fit, minmax(160px, 1fr))"
                    gap="4"
                  >
                    <For each={availablePictures()}>
                      {(item) => {
                        return (
                          <Box bg="bg.subtle" rounded="sm">
                            <NoteMediaSrcContextProvider
                              value={{
                                fileName: () => item.fileName,
                                source: () => "storage",
                              }}
                            >
                              <PictureMenu
                                delete
                                isSelected={isPictureSelected(item.fileName)}
                                onClick={() => {
                                  setNoteForm("picture", item.fileName);
                                }}
                              />
                            </NoteMediaSrcContextProvider>
                          </Box>
                        );
                      }}
                    </For>
                  </Grid>
                  <Box
                    borderBottomWidth="thin"
                    borderColor="border.default"
                  ></Box>

                  <HStack>
                    <Heading size="2xl">Sentence Audio</Heading>
                  </HStack>
                  <HStack justifyContent="center" maxH="64" alignItems="end">
                    <Box flex="1">
                      <NoteMediaSrcContextProvider
                        value={{
                          fileName: () => note.sentenceAudio,
                          source: () => "anki",
                        }}
                      >
                        <AudioWaveMenu
                          hideSelectButton={true}
                          isSelected={false}
                          onSelectClick={() => {
                            setNoteForm("sentenceAudio", undefined);
                          }}
                        />
                      </NoteMediaSrcContextProvider>
                    </Box>

                    <Box flexBasis="20">
                      <ArrowRightIcon
                        class={css({
                          h: "full",
                          w: "full",
                          maxW: "20",
                          color: "fg.subtle",
                        })}
                        strokeWidth="1"
                      />
                    </Box>
                    <Box flex="1">
                      <NoteMediaSrcContextProvider
                        value={{
                          fileName: () => noteForm.sentenceAudio,
                          source: () => "storage",
                        }}
                      >
                        <AudioWaveMenu
                          hideEditButton={true}
                          hideSelectButton={true}
                          isSelected={false}
                          onSelectClick={() => {}}
                        />
                      </NoteMediaSrcContextProvider>
                    </Box>
                  </HStack>
                  <For each={availableSentenceAudios()}>
                    {(item) => {
                      return (
                        <NoteMediaSrcContextProvider
                          value={{
                            fileName: () => item.fileName,
                            source: () => "storage",
                          }}
                        >
                          <AudioWaveMenu
                            isSelected={isSentenceAudioSelected(item.fileName)}
                            onSelectClick={() => {
                              setNoteForm("sentenceAudio", item.fileName);
                            }}
                          />
                        </NoteMediaSrcContextProvider>
                      );
                    }}
                  </For>
                </Stack>
                <HStack
                  justifyContent="end"
                  gap="4"
                  p="4"
                  borderTopWidth="thin"
                  borderColor="border.default"
                >
                  <IconButton
                    onClick={() => {
                      setNoteForm("picture", undefined);
                      setNoteForm("sentenceAudio", undefined);
                    }}
                  >
                    <UndoIcon />
                  </IconButton>
                  <Button
                    onClick={() => {
                      setOpen(false);
                    }}
                  >
                    Close
                  </Button>
                  <UpdateNoteButton
                    trigger={(triggerProps) => {
                      return (
                        <Button
                          {...triggerProps()}
                          disabled={
                            noteForm.picture === undefined &&
                            noteForm.sentenceAudio === undefined
                          }
                        >
                          Update Note
                        </Button>
                      );
                    }}
                  />
                </HStack>
              </Dialog.Content>
            </Dialog.Positioner>
          </Portal>
        </Suspense>
      </Dialog.Root>
    </NoteFormContextProvider>
  );
}

function UpdateNoteButton(props: {
  trigger: (triggerProps: () => ParentProps) => JSX.Element;
  onSuccess?: () => void;
}) {
  const [open, setOpen] = createSignal(false);
  const configQuery = SettingsQuery.ConfigQuery.detail.use();
  const note = useNoteContext();
  const [noteForm, setNoteForm] = useNoteFormContext();
  const updateNoteMutation = MiningMutation.AnkiMutation.updateNote();

  function updateNote() {
    appToaster.promise(
      updateNoteMutation.mutateAsync(
        {
          noteId: note.id,
          picture: noteForm.picture,
          sentenceAudio: noteForm.sentenceAudio,
        },
        {
          onSuccess: () => {
            setNoteForm("picture", undefined);
            setNoteForm("sentenceAudio", undefined);
            setOpen(false);
            props.onSuccess?.();
          },
        },
      ),
      {
        loading: {
          title: "Updating note...",
          description: `${note.expression}`,
        },
        error: {
          title: "Failed to update note",
          description: `${note.expression}`,
        },
        success: {
          title: "Note updated",
          description: `${note.expression}`,
        },
      },
    );
  }

  return (
    <Dialog.Root
      lazyMount
      open={open()}
      onOpenChange={(e) => {
        setOpen(e.open);
      }}
    >
      <Dialog.Trigger
        asChild={(triggerProps) => {
          return props.trigger(triggerProps);
        }}
      />
      <Dialog.Backdrop />
      <Suspense>
        <Portal mount={document.querySelector("#app") ?? document.body}>
          <Show when={!!noteForm.picture || !!noteForm.sentenceAudio}>
            <Dialog.Positioner p="4">
              <Dialog.Content w="fit" maxW="3xl" bg="bg.canvas">
                <Stack p="4" gap="6">
                  <Stack gap="1">
                    <Heading size="2xl">Update Note?</Heading>
                    <Dialog.Description>{note.id}</Dialog.Description>
                  </Stack>
                  <HStack gap="4" justifyContent="center" alignItems="start">
                    <Show when={!!noteForm.picture}>
                      <NoteMediaSrcContextProvider
                        value={{
                          fileName: () => noteForm.picture,
                          source: () => "storage",
                        }}
                      >
                        <Stack w="full" bg="bg.subtle" rounded="sm">
                          <PictureMenu
                            isSelected={false}
                            onClick={() => {}}
                            zoom={false}
                          />
                        </Stack>
                      </NoteMediaSrcContextProvider>
                    </Show>
                    <Show when={!!noteForm.sentenceAudio}>
                      <NoteMediaSrcContextProvider
                        value={{
                          fileName: () => noteForm.sentenceAudio,
                          source: () => "storage",
                        }}
                      >
                        <Stack w="full">
                          <AudioWaveMenu
                            hideEditButton={true}
                            hideSelectButton={true}
                            isSelected={false}
                            onSelectClick={() => {}}
                          />
                        </Stack>
                      </NoteMediaSrcContextProvider>
                    </Show>
                  </HStack>
                </Stack>
                <Dialog.Description px="4">
                  <Show when={!!noteForm.picture}>
                    Field <Code>{configQuery.data?.anki.pictureField}</Code>{" "}
                    will be updated to <Code>{noteForm.picture}</Code>
                    <br />
                  </Show>
                  <Show when={!!noteForm.sentenceAudio}>
                    Field{" "}
                    <Code>{configQuery.data?.anki.sentenceAudioField}</Code>
                    will be updated to <Code>{noteForm.sentenceAudio}</Code>
                    <br />
                  </Show>
                  <Show when={!!note.picture && noteForm.picture}>
                    Previous <Code>{note.picture}</Code> will be backed up{" "}
                    <br />
                  </Show>
                  <Show when={!!note.sentenceAudio && noteForm.sentenceAudio}>
                    Previous <Code>{note.sentenceAudio}</Code> will be backed up{" "}
                    <br />
                  </Show>
                </Dialog.Description>
                <HStack justifyContent="end" gap="4" p="4">
                  <Button
                    disabled={updateNoteMutation.isPending}
                    onClick={() => {
                      setOpen(false);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    loading={updateNoteMutation.isPending}
                    onClick={updateNote}
                  >
                    Confirm
                  </Button>
                </HStack>
              </Dialog.Content>
            </Dialog.Positioner>
          </Show>
        </Portal>
      </Suspense>
    </Dialog.Root>
  );
}
