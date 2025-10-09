import { Stack } from "styled-system/jsx";
import { Anki } from "./Anki";
import { OBS } from "./OBS";
import { Textractor } from "./Textractor";
import { VnOverlay } from "./VnOverlay";

export function SettingsTab() {
  return (
    <Stack gap="16">
      <Anki />
      <OBS />
      <Textractor />
      <VnOverlay />
    </Stack>
  );
}
