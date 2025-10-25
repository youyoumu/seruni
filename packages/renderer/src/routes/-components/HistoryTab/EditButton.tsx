import { ArrowRightIcon } from "lucide-solid";
import { createSelector, For } from "solid-js";
import { createStore } from "solid-js/store";
import { Portal } from "solid-js/web";
import { css } from "styled-system/css";
import { Box, Grid, HStack, Stack } from "styled-system/jsx";
import { Button } from "#/components/ui/button";
import { Dialog } from "#/components/ui/dialog";
import { Heading } from "#/components/ui/heading";
import { MiningQuery } from "#/lib/query/mining";
import { AudioWaveMenu } from "./AudioWave";
import {
  type NoteForm,
  NoteFormContextProvider,
  NoteMediaSrcContextProvider,
  useNoteContext,
} from "./Context";
import { PictureMenu } from "./Picture";

export function EditButton() {
  const { NoteMediaQuery } = MiningQuery;
  const note = useNoteContext();
  const noteMediaQuery = NoteMediaQuery.one.use({ noteId: note.id });
  const availablePictures = () =>
    noteMediaQuery.data.filter((m) => m.type === "picture");
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

  return (
    <NoteFormContextProvider value={[noteForm, setNoteForm]}>
      <Dialog.Root
        lazyMount
        // open={availablePictures().length > 0}
      >
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
                  <Heading size="2xl">Update Picture</Heading>
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
                  <Heading size="2xl">Update Sentence Audio</Heading>
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
                <Dialog.Trigger
                  asChild={(triggerProps) => {
                    return <Button {...triggerProps()}>Cancel</Button>;
                  }}
                />
                <Button
                  disabled={
                    noteForm.picture === undefined &&
                    noteForm.sentenceAudio === undefined
                  }
                >
                  Update Note
                </Button>
              </HStack>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </NoteFormContextProvider>
  );
}
