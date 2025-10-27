import { PauseIcon, PlayIcon } from "lucide-solid";
import { createSignal, Match, onCleanup, Switch } from "solid-js";
import { Stack } from "styled-system/jsx";
import { IconButton } from "#/components/ui/icon-button";
import { Slider } from "#/components/ui/slider";

export function AudioButton(props: { src: string }) {
  const [playing, setPlaying] = createSignal(false);
  const [progress, setProgress] = createSignal(0); // 0 → 1

  //TODO: reactive
  const audio = new Audio(props.src);

  const toggle = () => {
    if (playing()) {
      audio.pause();
    } else {
      audio.play();
    }
  };

  audio.addEventListener("play", () => setPlaying(true));
  audio.addEventListener("pause", () => setPlaying(false));
  audio.addEventListener("ended", () => setPlaying(false));

  audio.addEventListener("timeupdate", () => {
    if (audio.duration) setProgress((audio.currentTime / audio.duration) * 100);
  });

  onCleanup(() => {
    audio.pause();
    audio.src = "";
  });

  return (
    <Stack alignItems="center">
      <IconButton size="xs" onClick={toggle}>
        <Switch>
          <Match when={playing()}>
            <PauseIcon />
          </Match>
          <Match when={!playing()}>
            <PlayIcon />
          </Match>
        </Switch>
      </IconButton>
      <Slider value={[progress()]} defaultValue={[0]} w="32" />
    </Stack>
  );
}
