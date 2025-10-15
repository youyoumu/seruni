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
      maxW="8xl"
      mx="auto"
      h="full"
      pe="4"
      overflow="auto"
      class="custom-scrollbar"
    >
      <Stack gap="16" h="full" w="full" maxW="5xl" mx="auto">
        <Yomitan />
        <Python />
        <Anki />
        <OBS />
        <Textractor />
        <VnOverlay />
        <Debug />
      </Stack>
    </Stack>
  );
}
