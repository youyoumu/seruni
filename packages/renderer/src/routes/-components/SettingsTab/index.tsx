import { Stack } from "styled-system/jsx";
import { Anki } from "./Anki";
import { OBS } from "./OBS";
import { Textractor } from "./Textractor";
import { VnOverlay } from "./VnOverlay";
import { Yomitan } from "./Yomitan";

export function SettingsTab() {
  return (
    <Stack gap="16">
      <Yomitan />
      <Anki />
      <OBS />
      <Textractor />
      <VnOverlay />
    </Stack>
  );
}
