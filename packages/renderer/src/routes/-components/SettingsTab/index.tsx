import { Stack } from "styled-system/jsx";
import { Anki } from "./Anki";
import { OBS } from "./OBS";
import { VnOverlay } from "./VnOverlay";

export function SettingsTab() {
  return (
    <Stack gap="16">
      <Anki />
      <OBS />
      <VnOverlay />
    </Stack>
  );
}
