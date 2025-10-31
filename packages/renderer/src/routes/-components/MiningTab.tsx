import { createTimer } from "@solid-primitives/timer";
import { useQueryClient } from "@tanstack/solid-query";
import { intervalToDuration, isAfter } from "date-fns";
import { liveQuery } from "dexie";
import {
  ListRestartIcon,
  PauseIcon,
  PlayIcon,
  TrashIcon,
  XIcon,
} from "lucide-solid";
import type { JSX } from "solid-js";
import { css } from "styled-system/css";
import { Box, HStack, Stack } from "styled-system/jsx";
import { Select_ } from "#/components/Form";
import { Button } from "#/components/ui/button";
import { Dialog } from "#/components/ui/dialog";
import { IconButton } from "#/components/ui/icon-button";
import { RadioGroup } from "#/components/ui/radio-group";
import { createListCollection } from "#/components/ui/select";
import { Skeleton } from "#/components/ui/skeleton";
import { Text } from "#/components/ui/text";
import { texthoookerDB } from "#/lib/db";
import { keyStore } from "#/lib/query/_util";
import { MiningMutation, MiningQuery } from "#/lib/query/queryMining";
import { localStore, setLocalStore } from "#/lib/store";
import { inspect } from "#/lib/util";
import { appToaster } from "./AppToaster";
import { AnkiCard } from "./HistoryTab/AnkiCard";
import { NoteContextProvider } from "./HistoryTab/Context";

const isNotJapaneseRegex =
  /[^0-9A-Z○◯々-〇〻ぁ-ゖゝ-ゞァ-ヺー０-９Ａ-Ｚｦ-ﾝ\p{Radical}\p{Unified_Ideograph}]+/gimu;

export function MiningTab() {
  const queryClient = useQueryClient();
  let textContainerRef: HTMLDivElement | undefined;
  const [now, setNow] = createSignal(new Date());
  createTimer(
    () => {
      setNow(new Date());
    },
    1000,
    setInterval,
  );

  const timer = () => localStore.texthookerTimer;
  const [timerRunning, setTimerRunning] = createSignal(false);
  createTimer(
    () => {
      setLocalStore("texthookerTimer", (value) => value + 1);
    },
    () => (timerRunning() ? 1000 : false),
    setInterval,
  );

  const [texts, setTexts] = createStore<{
    value: Array<{ text: string; uuid: string }>;
  }>({ value: [] });
  const textObservable = liveQuery(() => texthoookerDB.text.toArray());
  textObservable.subscribe({
    next: (result) => {
      setTexts("value", reconcile(result));
    },
  });

  const replayBufferStartTimeQuery =
    MiningQuery.ObsQuery.replayBufferStartTime.use();
  const replayBufferStartTime = () => replayBufferStartTimeQuery.data?.time;
  const replayBufferDurationQuery =
    MiningQuery.ObsQuery.replayBufferDuration.use();
  const textHistoryQuery = MiningQuery.SessionQuery.textHistory.use();
  const replayBufferDuration = () => replayBufferDurationQuery.data.duration;
  const textHistory = () => textHistoryQuery.data;

  const notInHistoryTexts = createMemo(() => {
    const historyUuids = new Set(textHistory().map((item) => item.uuid));
    return texts.value.filter((item) => !historyUuids.has(item.uuid));
  });
  const notInHistoryTextsUuids = createMemo(() => {
    return new Set(notInHistoryTexts().map((item) => item.uuid));
  });

  const withinBufferTexts = () => {
    const startTime = replayBufferStartTime();
    const maxDuration = replayBufferDuration();
    if (!startTime || maxDuration <= 0) return [];

    const timeSinceStart = now().getTime() - startTime.getTime();
    const effectiveDuration = Math.min(timeSinceStart, maxDuration);

    const bufferStartTime = new Date(now().getTime() - effectiveDuration);
    return textHistory().filter((item) => {
      // Only include text that falls inside the active replay buffer window
      return (
        isAfter(item.time, bufferStartTime) && isAfter(item.time, startTime)
      );
    });
  };
  const withinBufferTextsUuids = createMemo(() => {
    return new Set(withinBufferTexts().map((item) => item.uuid));
  });

  function getCharacterCount(text: string) {
    if (!text) return 0;
    return text.replace(isNotJapaneseRegex, "").length;
  }

  const characterCount = () =>
    texts.value
      .map((item) => getCharacterCount(item.text))
      .reduce((a, b) => a + b, 0);

  const formattedDuration = () => {
    const d = intervalToDuration({
      start: new Date(0),
      end: new Date(timer() * 1000),
    });
    const totalHours = (d.days ?? 0) * 24 + (d.hours ?? 0);
    const m = String(d.minutes ?? 0).padStart(2, "0");
    const s = String(d.seconds ?? 0).padStart(2, "0");
    const h = String(totalHours).padStart(2, "0");
    return `${h}:${m}:${s}`;
  };

  const speed = () => {
    if (timer() === 0) return 0; // prevent division by zero
    return Math.round((characterCount() / timer()) * 60 * 60);
  };

  onMount(async () => {
    ipcRenderer.on("mining:sendReplayBufferStartTime", ({ time }) => {
      queryClient.setQueryData(
        keyStore["mining:obs"].replayBufferStartTime.queryKey,
        { time },
      );
    });
    ipcRenderer.on("mining:sendReplayBufferDuration", ({ duration }) => {
      queryClient.setQueryData(
        keyStore["mining:obs"].replayBufferDuration.queryKey,
        { duration },
      );
    });

    ipcRenderer.on("vnOverlay:sendText", (payload) => {
      if (textContainerRef) {
        textContainerRef.scrollTop = textContainerRef.scrollHeight;
      }
      if (!timerRunning()) {
        appToaster.create({
          title: "Textractor",
          description: "Received text but timer is paused",
          type: "info",
        });
        return;
      }
      texthoookerDB.text.add({
        text: payload.text,
        uuid: payload.uuid,
      });

      queryClient.invalidateQueries({
        queryKey: keyStore["mining:session"].textHistory.queryKey,
      });
    });
  });

  return (
    <>
      <DuplicateNoteConfirmation />
      <Stack h="full" maxW="8xl" mx="auto">
        <HStack justifyContent="end" pb="4">
          <Text fontWeight="semibold">
            {characterCount()} characters in {formattedDuration()}
          </Text>
          <Box
            class={css({
              bg: "border.default",
              h: "full",
              w: "0.5",
            })}
          ></Box>
          <Text fontWeight="semibold">{speed()} characters/hour</Text>
          <Box
            class={css({
              bg: "border.default",
              h: "full",
              w: "0.5",
            })}
          ></Box>
          <Show when={!timerRunning()}>
            <IconButton
              size="xs"
              onClick={() => {
                setTimerRunning((prev) => !prev);
              }}
            >
              <PlayIcon></PlayIcon>
            </IconButton>
          </Show>
          <Show when={timerRunning()}>
            <IconButton
              size="xs"
              onClick={() => {
                setTimerRunning((prev) => !prev);
              }}
            >
              <PauseIcon></PauseIcon>
            </IconButton>
          </Show>
          <ResetTextButton
            trigger={(onClick) => (
              <IconButton size="xs" onClick={onClick}>
                <ListRestartIcon></ListRestartIcon>
              </IconButton>
            )}
            onConfirm={() => {
              setLocalStore("texthookerTimer", 0);
              texthoookerDB.text.clear();
              appToaster.create({
                description: "Stats have been reset.",
                type: "info",
              });
            }}
          />
        </HStack>

        <Stack
          gap="12"
          overflow="auto"
          p="4"
          pb="64"
          ref={textContainerRef}
          class="custom-scrollbar"
        >
          <For each={texts.value}>
            {(item) => {
              return (
                <HStack
                  position="relative"
                  alignItems="center"
                  gap="4"
                  p="2"
                  borderColor="border.default"
                  borderBottomWidth="thin"
                  bg={{
                    _hover: "bg.subtle",
                  }}
                >
                  {"\n"}
                  <Text
                    as="p"
                    fontSize="xl"
                    flex="1"
                    color={
                      notInHistoryTextsUuids().has(item.uuid)
                        ? "fg.muted"
                        : withinBufferTextsUuids().has(item.uuid)
                          ? "fg.default"
                          : "fg.error"
                    }
                  >
                    {item.text}
                    <span
                      style={{
                        opacity: 0.01,
                        "font-size": "0.1px",
                      }}
                    >{`‹uuid:${item.uuid}›`}</span>
                  </Text>
                  {"\n"}
                  <TrashIcon
                    class={css({
                      h: "5",
                      w: "5",
                      cursor: "pointer",
                      color: "fg.error",
                    })}
                    onClick={() => {
                      texthoookerDB.text
                        .where("uuid")
                        .equals(item.uuid)
                        .delete();
                    }}
                  ></TrashIcon>
                </HStack>
              );
            }}
          </For>
        </Stack>
      </Stack>
    </>
  );
}

function ResetTextButton(props: {
  trigger: (onClick: () => void) => JSX.Element;
  onConfirm?: () => void;
}) {
  const [open, setOpen] = createSignal(false);

  return (
    <Dialog.Root open={open()} onOpenChange={() => setOpen(false)}>
      <Dialog.Trigger asChild={() => props.trigger(() => setOpen(true))} />
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content>
          <Stack gap="8" p="6">
            <Stack gap="1">
              <Dialog.Title>Reset Stats?</Dialog.Title>
              <Dialog.Description>
                This will reset the characters count and timer
              </Dialog.Description>
            </Stack>
            <Stack gap="3" direction="row" width="full">
              <Dialog.CloseTrigger
                asChild={(closeTriggerProps) => (
                  <Button {...closeTriggerProps()} variant="outline" flex="1">
                    Cancel
                  </Button>
                )}
              />

              <Button
                flex="1"
                onClick={() => {
                  props.onConfirm?.();
                  setOpen(false);
                }}
              >
                Confirm
              </Button>
            </Stack>
          </Stack>
          <Dialog.CloseTrigger
            asChild={(closeTriggerProps) => (
              <IconButton
                {...closeTriggerProps()}
                aria-label="Close Dialog"
                variant="ghost"
                size="sm"
                position="absolute"
                top="2"
                right="2"
              >
                <XIcon />
              </IconButton>
            )}
          />
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}

export function DuplicateNoteConfirmation() {
  const [open, setOpen] = createSignal(false);
  const [noteIds, setNoteIds] = createSignal<number[]>([]);

  const queryClient = useQueryClient();
  createEffect(() => {
    noteIds().forEach((noteId) => {
      queryClient.prefetchQuery(
        MiningQuery.AnkiQuery.noteInfo.options({ noteId }),
      );
    });
  });

  const options = [
    { id: "create", label: "Create" },
    { id: "update", label: "Update" },
  ];

  const [duplicateNoteConfirmationForm, setDuplicateNoteConfirmationForm] =
    createStore<{
      uuid: string;
      action: "create" | "update";
      params: { noteId: number | null };
    }>({
      uuid: "",
      action: "update" as const,
      params: { noteId: null },
    });

  onMount(() => {
    ipcRenderer.on("mining:duplicateNoteConfirmation", ({ uuid, noteIds }) => {
      setDuplicateNoteConfirmationForm("uuid", uuid);
      setNoteIds(noteIds);
      setDuplicateNoteConfirmationForm("params", "noteId", noteIds[0] ?? null);
      setOpen(true);
    });
  });

  const confirmDuplicateNoteMutation =
    MiningMutation.AnkiMutation.confirmDuplicateNote();

  const confirmDuplicateNote = async () => {
    const noteId = duplicateNoteConfirmationForm.params.noteId;
    confirmDuplicateNoteMutation.mutateAsync(
      {
        uuid: duplicateNoteConfirmationForm.uuid,
        action: duplicateNoteConfirmationForm.action,
        params: noteId ? { noteId } : undefined,
      },
      {
        onSuccess: () => {
          setOpen(false);
        },
      },
    );
  };

  return (
    <Dialog.Root lazyMount open={open()} onOpenChange={(e) => setOpen(e.open)}>
      <Dialog.Backdrop />
      <Portal mount={document.querySelector("#app") ?? document.body}>
        <Dialog.Positioner p="4">
          <Dialog.Content w="full" maxW="3xl" bg="bg.canvas">
            <Stack gap="8" p="6">
              <Stack gap="1">
                <Dialog.Title>Duplicate Note Detected</Dialog.Title>
                <Dialog.Description>
                  Do you want to create a new note or update the existing one?
                </Dialog.Description>
              </Stack>
              <RadioGroup.Root
                value={duplicateNoteConfirmationForm.action}
                onValueChange={(e) => {
                  if (e.value)
                    setDuplicateNoteConfirmationForm(
                      "action",
                      e.value as "create",
                    );
                }}
                flexDirection="row"
              >
                <For each={options}>
                  {(option) => (
                    <RadioGroup.Item value={option.id}>
                      <RadioGroup.ItemControl />
                      <RadioGroup.ItemText>{option.label}</RadioGroup.ItemText>
                      <RadioGroup.ItemHiddenInput />
                    </RadioGroup.Item>
                  )}
                </For>
              </RadioGroup.Root>
              <Show when={duplicateNoteConfirmationForm.action === "update"}>
                <Select_
                  value={[
                    duplicateNoteConfirmationForm.params.noteId?.toString() ??
                      "",
                  ]}
                  placeholder="Select Note ID"
                  label="Note ID"
                  onValueChange={(e) => {
                    setDuplicateNoteConfirmationForm(
                      "params",
                      "noteId",
                      Number(e.items[0]?.value),
                    );
                  }}
                  collection={createListCollection({
                    items: noteIds().map((item) => ({
                      label: item.toString(),
                      value: item.toString(),
                    })),
                  })}
                />
              </Show>
              <Show
                when={
                  duplicateNoteConfirmationForm.action === "update" &&
                  duplicateNoteConfirmationForm.params.noteId
                }
              >
                <NoteInfo
                  noteId={duplicateNoteConfirmationForm.params.noteId ?? 0}
                />
              </Show>

              <HStack justifyContent="end">
                <Button variant="subtle" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button
                  disabled={
                    duplicateNoteConfirmationForm.action === "update" &&
                    duplicateNoteConfirmationForm.params.noteId === null
                  }
                  onClick={confirmDuplicateNote}
                >
                  Confirm
                </Button>
              </HStack>
            </Stack>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}

function NoteInfo(props: { noteId: number }) {
  const noteInfoQuery = MiningQuery.AnkiQuery.noteInfo.use({
    noteId: () => props.noteId,
  });

  //TODO: move components

  return (
    <Suspense fallback={<Skeleton h="64" />}>
      <Show when={noteInfoQuery.data}>
        {(data) => {
          return (
            <NoteContextProvider value={data}>
              <AnkiCard readOnly />
            </NoteContextProvider>
          );
        }}
      </Show>
    </Suspense>
  );
}
