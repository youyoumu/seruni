import { makePersisted } from "@solid-primitives/storage";
import { intervalToDuration } from "date-fns";
import { liveQuery } from "dexie";
import { ListRestartIcon, PauseIcon, PlayIcon, TrashIcon } from "lucide-solid";
import {
  createEffect,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import { css } from "styled-system/css";
import { Box, HStack, Stack } from "styled-system/jsx";
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
  const textObservable = liveQuery(() => texthoookerDB.text.toArray());
  textObservable.subscribe({
    next: (result) => {
      setTexts(result);
    },
  });
  let textContainerRef: HTMLDivElement | undefined;

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
        appToaster.info({
          description: "Timer is paused",
        });
        return;
      }
      texthoookerDB.text.add({
        text: payload.text,
        uuid: payload.uuid,
      });
    });
  });

  return (
    <Stack h="full">
      <HStack
        justifyContent="end"
        borderColor="border.default"
        borderBottomWidth="thin"
        pb="4"
      >
        <Box>
          {characterCount()} characters in {formattedDuration()}
        </Box>
        <Box
          class={css({
            bg: "border.default",
            h: "full",
            w: "0.5",
          })}
        ></Box>
        <Box>{speed()} characters/hour</Box>
        <Box
          class={css({
            bg: "border.default",
            h: "full",
            w: "0.5",
          })}
        ></Box>
        <Show when={!timerRunning()}>
          <PlayIcon
            class={css({ h: "5", w: "5", cursor: "pointer" })}
            onClick={() => {
              setTimerRunning((prev) => !prev);
            }}
          ></PlayIcon>
        </Show>
        <Show when={timerRunning()}>
          <PauseIcon
            class={css({ h: "5", w: "5", cursor: "pointer" })}
            onClick={() => {
              setTimerRunning((prev) => !prev);
            }}
          ></PauseIcon>
        </Show>
        <ListRestartIcon
          class={css({ h: "5", w: "5", cursor: "pointer" })}
          onClick={() => {
            setTimer(0);
            texthoookerDB.text.clear();
          }}
        ></ListRestartIcon>
      </HStack>
      <Stack
        gap="12"
        overflow="auto"
        p="4"
        pb="64"
        ref={textContainerRef}
        class="custom-scrollbar"
      >
        <For each={texts()}>
          {(item) => {
            return (
              <HStack
                alignItems="center"
                gap="4"
                pb="2"
                borderColor="border.default"
                borderBottomWidth="thin"
              >
                <Box as="p" fontSize="xl" flex="1">
                  {item.text}
                </Box>
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
