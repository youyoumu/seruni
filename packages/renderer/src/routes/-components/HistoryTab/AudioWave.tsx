import { createEffect, createSignal, onCleanup, onMount } from "solid-js";
import { css } from "styled-system/css";
import { Box, Stack } from "styled-system/jsx";
import { token } from "styled-system/tokens";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.esm.js";
import { Button } from "#/components/ui/button";

const regions = RegionsPlugin.create();

export function AudioWave(props: { url: string | undefined }) {
  const [trimData, setTrimData] = createSignal<{ start: number; end: number }>({
    start: 0,
    end: 3,
  });
  let containerEl: HTMLDivElement | undefined;
  const [playing, setPlaying] = createSignal(false);

  let wavesurfer: WaveSurfer | undefined;

  onMount(() => {
    if (!containerEl) return;
    wavesurfer = WaveSurfer.create({
      container: containerEl,
      waveColor: token("colors.amber.dark.a10"),
      progressColor: token("colors.gray.dark.a8"),
      url: props.url,
      plugins: [regions],
      dragToSeek: true,
    });

    const content = document.createElement("div");
    content.style.color = token("colors.gray.dark.a11");
    content.style.fontSize = token("fontSizes.sm");
    content.innerText = "Trim";

    wavesurfer.on("decode", () => {
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
  });

  createEffect(() => {
    if (playing()) wavesurfer?.play();
    if (!playing()) wavesurfer?.pause();
  });

  createEffect(() => {
    console.log(trimData());
  });

  return (
    <Stack>
      <Box ref={containerEl} />
      <Button
        onClick={() => {
          setPlaying(!playing());
        }}
      >
        {playing() ? "Pause" : "Play"}
      </Button>
    </Stack>
  );
}
