import { Stack } from "styled-system/jsx";
import { Anki } from "./Anki";
import { Debug } from "./Debug";
import { OBS } from "./OBS";
import { Textractor } from "./Textractor";
import { VnOverlay } from "./VnOverlay";
import { Yomitan } from "./Yomitan";

export function SettingsTab() {
  return (
    <Stack gap="16" h="full" overflow="auto" class="custom-scrollbar" pe="4">
      <Yomitan />
      <Anki />
      <OBS />
      <Textractor />
      <VnOverlay />
      <Debug />
    </Stack>
  );
}
