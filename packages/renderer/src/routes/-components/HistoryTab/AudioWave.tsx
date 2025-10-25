import {
  ArrowRightIcon,
  AudioLinesIcon,
  PauseIcon,
  PlayIcon,
  RatIcon,
} from "lucide-solid";
import {
  createEffect,
  createSignal,
  Match,
  onCleanup,
  Show,
  type Signal,
  Switch,
} from "solid-js";
import { Portal } from "solid-js/web";
import { Box, HStack, Stack } from "styled-system/jsx";
import { token } from "styled-system/tokens";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.esm.js";
import { Flip } from "#/components/Flip";
import { Button } from "#/components/ui/button";
import { Dialog } from "#/components/ui/dialog";
import { Icon } from "#/components/ui/icon";
import { IconButton } from "#/components/ui/icon-button";
import { Text } from "#/components/ui/text";
import { GeneralQuery } from "#/lib/query/general";
import { useNoteMediaSrcContext } from "./Context";

function AudioWave(props: {
  playing: boolean;
  height?: number;
  trim?: boolean;
  trimDataSignal?: Signal<{ start: number; end: number }>;
}) {
  const noteMediaSrc = useNoteMediaSrcContext();
  const mediaUrlQuery = GeneralQuery.HttpServerUrlQuery.mediaUrl.use(
    () => noteMediaSrc.fileName(),
    () => noteMediaSrc.source(),
  );
  const src = () => mediaUrlQuery.data ?? "";
  const [trimData, setTrimData] =
    props.trimDataSignal ??
    createSignal({
      start: 0,
      end: 3,
    });
  let containerEl: HTMLDivElement | undefined;

  let wavesurfer: WaveSurfer | undefined;
  const regions = RegionsPlugin.create();

  function setupWaveSurfer() {
    if (!containerEl || !src()) return;
    wavesurfer = WaveSurfer.create({
      container: containerEl,
      waveColor: token("colors.amber.dark.a9"),
      progressColor: token("colors.gray.dark.a8"),
      url: src(),
      plugins: [regions],
      dragToSeek: true,
      height: props.height ?? 64,
      normalize: true,
      barWidth: 4,
      barGap: 1,
      barRadius: 10,
    });

    const content = document.createElement("div");
    content.style.color = token("colors.gray.dark.a11");
    content.style.fontSize = token("fontSizes.sm");
    content.innerText = "Trim";

    wavesurfer.on("decode", () => {
      if (!props.trim) return;
      regions.addRegion({
        start: trimData().start,
        end: trimData().end,
        minLength: 1.5,
        content: content,
        color: token("colors.gray.dark.a5"),
        drag: true,
        resize: true,
      });
      regions.on("region-updated", (region) => {
        setTrimData({
          start: region.start,
          end: region.end,
        });
      });
    });

    onCleanup(() => wavesurfer?.destroy());
  }

  createEffect(() => {
    src();
    setupWaveSurfer();
  });

  createEffect(() => {
    if (props.playing) wavesurfer?.play();
    if (!props.playing) wavesurfer?.pause();
  });

  createEffect(() => {});

  return <Box ref={containerEl} w="full" />;
}

export function AudioWaveMenu(props: {
  isSelected: boolean;
  onSelectClick: () => void;
  hidePlayButton?: boolean;
  hideEditButton?: boolean;
  hideSelectButton?: boolean;
}) {
  const noteMediaSrc = useNoteMediaSrcContext();
  const [playing, setPlaying] = createSignal(false);

  return (
    <Switch>
      <Match when={!!noteMediaSrc.fileName()}>
        <Stack alignItems="start" gap="2">
          <HStack>
            <Show when={props.hidePlayButton !== true}>
              <IconButton
                size="xs"
                onClick={() => {
                  setPlaying(!playing());
                }}
              >
                <Switch>
                  <Match when={!playing()}>
                    <PlayIcon></PlayIcon>
                  </Match>

                  <Match when={playing()}>
                    <PauseIcon></PauseIcon>
                  </Match>
                </Switch>
              </IconButton>
            </Show>
            <Show when={props.hideEditButton !== true}>
              <EditAudioButton />
            </Show>
            <Show when={props.hideSelectButton !== true}>
              <IconButton
                size="xs"
                onClick={() => {
                  props.onSelectClick();
                }}
              >
                <ArrowRightIcon />
              </IconButton>
            </Show>
          </HStack>

          <Text size="sm" color="fg.muted">
            {noteMediaSrc.fileName()}
          </Text>
          <Box
            w="full"
            py="2"
            rounded="sm"
            outlineColor={
              props.isSelected ? "colorPalette.default" : "transparent"
            }
            outlineWidth="medium"
            outlineStyle="solid"
          >
            <AudioWave playing={playing()} />
          </Box>
        </Stack>
      </Match>
      <Match when={!noteMediaSrc.fileName()}>
        <Stack
          bg="bg.subtle"
          w="full"
          h="20"
          rounded="sm"
          justifyContent="center"
          alignItems="center"
        >
          <Flip>
            <Icon
              color="fg.muted"
              width="12"
              height="12"
              strokeWidth="1"
              asChild={(iconProps) => <RatIcon {...iconProps()} />}
            />
          </Flip>
        </Stack>
      </Match>
    </Switch>
  );
}

function EditAudioButton() {
  const noteMediaSrc = useNoteMediaSrcContext();
  const mediaUrlQuery = GeneralQuery.HttpServerUrlQuery.mediaUrl.use(
    () => noteMediaSrc.fileName(),
    () => noteMediaSrc.source(),
  );
  const src = () => mediaUrlQuery.data ?? "";
  const [playing, setPlaying] = createSignal(false);

  const [trimData, setTrimData] = createSignal<{ start: number; end: number }>({
    start: 0,
    end: 3,
  });

  return (
    <Dialog.Root lazyMount>
      <Dialog.Trigger
        asChild={(triggerProps) => {
          return (
            <IconButton size="xs" {...triggerProps()}>
              <AudioLinesIcon />
            </IconButton>
          );
        }}
      />
      <Dialog.Backdrop />
      <Portal mount={document.querySelector("#app") ?? document.body}>
        <Dialog.Positioner p="4">
          <Dialog.Content w="full" maxW="5xl" bg="bg.canvas">
            <Stack alignItems="start" gap="4">
              <Box p="8" w="full">
                <AudioWave
                  playing={playing()}
                  height={128}
                  trim
                  trimDataSignal={[trimData, setTrimData]}
                />
              </Box>
              <HStack
                alignItems="end"
                justifyContent="end"
                w="full"
                p="4"
                borderTopWidth="thin"
                borderColor="border.default"
              >
                <Text size="sm" color="fg.muted">
                  {src()}
                </Text>
                <IconButton
                  onClick={() => {
                    setPlaying(!playing());
                  }}
                >
                  <Switch>
                    <Match when={!playing()}>
                      <PlayIcon></PlayIcon>
                    </Match>

                    <Match when={playing()}>
                      <PauseIcon></PauseIcon>
                    </Match>
                  </Switch>
                </IconButton>
                <Button>Copy and Save</Button>
              </HStack>
            </Stack>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
