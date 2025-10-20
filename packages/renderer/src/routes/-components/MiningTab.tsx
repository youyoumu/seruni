import { makePersisted } from "@solid-primitives/storage";
import { intervalToDuration } from "date-fns";
import { liveQuery } from "dexie";
import {
  ArrowBigRight,
  ListRestartIcon,
  PauseIcon,
  PlayIcon,
  TrashIcon,
  XIcon,
} from "lucide-solid";
import {
  createEffect,
  createSignal,
  For,
  type JSX,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import { css } from "styled-system/css";
import { Box, HStack, Stack } from "styled-system/jsx";
import { Button } from "#/components/ui/button";
import { Dialog } from "#/components/ui/dialog";
import { Icon } from "#/components/ui/icon";
import { IconButton } from "#/components/ui/icon-button";
import { Text } from "#/components/ui/text";
import { texthoookerDB } from "#/lib/db";
import { appToaster } from "./AppToaster";

export function MiningTab() {
  const vnDialogues = [
    "おはよう、昨日はよく眠れた？",
    "あれ、もう来てたの？早いね。",
    "ちょっと待って、髪にゴミついてるよ。",
    "ねえ、放課後に少し話せる？",
    "そんな顔しないでよ、冗談だってば。",
    "この場所、なんか落ち着くね。",
    "今日の授業、全然わからなかった……。",
    "その笑い方、昔と変わってないね。",
    "一緒に帰ろうか？",
    "あっ、雨降ってきた！傘持ってる？",
    "あのさ、前から言いたかったことがあるんだ。",
    "ありがとう。君がいてくれてよかった。",
    "ねえ、もし明日も晴れたら、どこか行こうよ。",
    "ちょっと！寝てる場合じゃないってば！",
    "……ねえ、私のこと、どう思ってるの？",
  ];

  const [timer, setTimer] = makePersisted(createSignal(0), {
    name: "texthookerTimer",
  });
  const [timerRunning, setTimerRunning] = createSignal(false);
  const [texts, setTexts] = createSignal<{ text: string; uuid: string }[]>(
    // vnDialogues.map((text) => ({ text, uuid: crypto.randomUUID() })),
    [],
  );
  const [textHistory, setTextHistory] = createSignal<
    { text: string; uuid: string; time: Date }[]
  >([]);
  const [textUuid, setTextUuid] = createSignal("");
  const textObservable = liveQuery(() => texthoookerDB.text.toArray());
  textObservable.subscribe({
    next: (result) => {
      setTexts(result);
    },
  });
  let textContainerRef: HTMLDivElement | undefined;

  const expiredTexts = () =>
    texts().filter((item) => {
      return !textHistory().some((item_) => item_.uuid === item.uuid);
    });

  const isNotJapaneseRegex =
    /[^0-9A-Z○◯々-〇〻ぁ-ゖゝ-ゞァ-ヺー０-９Ａ-Ｚｦ-ﾝ\p{Radical}\p{Unified_Ideograph}]+/gimu;

  function getCharacterCount(text: string) {
    if (!text) return 0;
    return Array.from(text.replace(isNotJapaneseRegex, "")).length;
  }

  const characterCount = () =>
    texts()
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

  createEffect(() => {
    if (!timerRunning()) return; // if paused, do nothing
    const interval = setInterval(() => {
      setTimer((prev) => prev + 1);
    }, 1000);
    onCleanup(() => clearInterval(interval)); // auto-clears when paused or unmounted
  });

  onMount(async () => {
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

      ipcRenderer.invoke("mining:getTextHistory").then((history) => {
        setTextHistory(history);
      });
    });

    const textHistory = await ipcRenderer.invoke("mining:getTextHistory");
    setTextHistory(textHistory);
  });

  let hoverTimeout: number | undefined;

  return (
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
            setTimer(0);
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
        ps="6"
        pb="64"
        ref={textContainerRef}
        class="custom-scrollbar"
      >
        <For each={texts()}>
          {(item) => {
            return (
              <HStack
                position="relative"
                alignItems="center"
                gap="4"
                p="2"
                borderColor="border.default"
                borderBottomWidth="thin"
                onMouseEnter={() => {
                  hoverTimeout = window.setTimeout(() => {
                    ipcRenderer
                      .invoke("mining:setTextUuid", { uuid: item.uuid })
                      .then(({ uuid }) => setTextUuid(uuid));
                  }, 250); // delay in ms
                }}
                onMouseLeave={() => {
                  // cancel if cursor leaves early
                  clearTimeout(hoverTimeout);
                }}
                bg={{
                  _hover: "bg.subtle",
                }}
              >
                <Icon
                  class={css({
                    position: "absolute",
                    left: "-6",
                    color: "colorPalette.default",
                  })}
                  style={{
                    transition: "opacity 0.2s, transform 0.2s",
                    transform: `translateX(${item.uuid === textUuid() ? "0" : "-10px"})`,
                    opacity: item.uuid === textUuid() ? 1 : 0,
                  }}
                  asChild={(props) => {
                    return <ArrowBigRight {...props()} />;
                  }}
                ></Icon>
                {"\n"}
                <Text
                  as="p"
                  fontSize="xl"
                  flex="1"
                  color={
                    expiredTexts().some((item_) => item_.uuid === item.uuid)
                      ? "fg.muted"
                      : "fg.default"
                  }
                >
                  {item.text}
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
                    texthoookerDB.text.where("uuid").equals(item.uuid).delete();
                  }}
                ></TrashIcon>
              </HStack>
            );
          }}
        </For>
      </Stack>
    </Stack>
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
