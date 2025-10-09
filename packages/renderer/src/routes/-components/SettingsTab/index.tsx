import { Flex, Stack } from "styled-system/jsx";
import { Anki } from "./Anki";
import { VnOverlay } from "./VnOverlay";

export function SettingsTab() {
  return (
    <Stack gap="16">
      <Anki />
      <VnOverlay />
    </Stack>
  );
}
