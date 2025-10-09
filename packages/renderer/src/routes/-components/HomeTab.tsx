import { createSignal, onCleanup, onMount } from "solid-js";
import { HStack, Stack } from "styled-system/jsx";
import { Button } from "#/components/ui/button";
import { appToaster } from "./AppToaster";
import { Sidebar } from "./Sidebar";

export function HomeTab() {
  const [ankiStatus, setAnkiStatus] = createSignal("disconnected");
  const [obsStatus, setObsStatus] = createSignal("disconnected");
  const [textractorStatus, setTextractorStatus] = createSignal("disconnected");

  onMount(() => {
    const id = setInterval(() => {
      ipcRenderer.invoke("general:getClientStatus").then((status) => {
        setAnkiStatus(status.anki);
        setObsStatus(status.obs);
        setTextractorStatus(status.textractor);
      });
    }, 1000);
    onCleanup(() => clearInterval(id));
  });

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
