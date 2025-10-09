import { Stack } from "styled-system/jsx";
import { Anki } from "./Anki";
import { Debug } from "./Debug";
import { OBS } from "./OBS";
import { Python } from "./Python";
import { Textractor } from "./Textractor";
import { VnOverlay } from "./VnOverlay";
import { Yomitan } from "./Yomitan";

export function SettingsTab() {
  return (
    <Stack
      gap="16"
      h="full"
      overflow="auto"
      class="custom-scrollbar"
      pe="4"
      maxW="8xl"
      mx="auto"
    >
      <Yomitan />
      <Python />
      <Anki />
      <OBS />
      <Textractor />
      <VnOverlay />
      <Debug />
    </Stack>
  );
}
