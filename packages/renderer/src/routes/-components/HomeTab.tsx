import { Flex } from "styled-system/jsx";
import { Button } from "#/components/ui/button";
import { appToaster } from "./AppToaster";
import { Sidebar } from "./Sidebar";

export function HomeTab() {
  return (
    <Flex gap="2">
      <Button
        onClick={() => {
          ipcRenderer.send("vnOverlay:open");
        }}
      >
        Open VN Overlay
      </Button>
      <Button
        onClick={() => {
          ipcRenderer.send("yomitan:open");
        }}
      >
        Open Yomitan Settings
      </Button>
      <Button
        onClick={() => {
          ipcRenderer.send("yomitan:reinstall");
        }}
      >
        Update Yomitan
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
      <Button
        onClick={() => {
          ipcRenderer.send("settings:installPython");
        }}
      >
        Install python
      </Button>
      <Sidebar />
    </Flex>
  );
}
