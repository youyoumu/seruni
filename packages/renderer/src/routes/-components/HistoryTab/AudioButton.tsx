import { createAudio } from "@solid-primitives/audio";
import { PauseIcon, PlayIcon } from "lucide-solid";
import { createEffect, createSignal, Match, Show, Switch } from "solid-js";
import { Stack } from "styled-system/jsx";
import { IconButton } from "#/components/ui/icon-button";
import { Slider } from "#/components/ui/slider";

export function AudioButton(props: { src: string }) {
  const [playing, setPlaying] = createSignal(false);
  const [audioState] = createAudio(() => props.src, playing);
  const progress = () => (audioState.currentTime / audioState.duration) * 100;
  const [ready, setReady] = createSignal(false);

  createEffect(() => {
    if (audioState.state === "complete") setPlaying(false);
    if (audioState.state === "ready") setReady(true);
  });

  return (
    <Show when={ready()}>
      <Stack alignItems="center">
        <IconButton size="xs" onClick={() => setPlaying((prev) => !prev)}>
          <Switch>
            <Match when={audioState.state === "playing"}>
              <PauseIcon />
            </Match>
            <Match when={audioState.state !== "playing"}>
              <PlayIcon />
            </Match>
          </Switch>
        </IconButton>
        <Slider value={[progress()]} defaultValue={[0]} w="32" />
      </Stack>
    </Show>
  );
}
