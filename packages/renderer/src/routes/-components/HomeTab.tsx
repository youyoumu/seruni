import { HStack, Stack } from "styled-system/jsx";
import { Button } from "#/components/ui/button";
import { appToaster } from "./AppToaster";
import { Sidebar } from "./Sidebar";

export function HomeTab() {
  return (
    <Stack gap="2" maxW="8xl" mx="auto">
      <HStack>
        <Button
          onClick={() => {
            ipcRenderer.send("vnOverlay:open");
          }}
        >
          Open VN Overlay
        </Button>

        <Button
          onClick={() => {
            appToaster.info({
              title: "Info",
              description: "This is an info toast.",
            });
          }}
        >
          Toast
        </Button>
        <Sidebar />
      </HStack>
    </Stack>
  );
}
