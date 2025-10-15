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
    <Stack maxW="8xl" mx="auto" pe="4">
      <Stack
        gap="16"
        h="full"
        overflow="auto"
        class="custom-scrollbar"
        w="full"
        maxW="5xl"
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
    </Stack>
  );
}
