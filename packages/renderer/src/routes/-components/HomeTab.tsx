import { Flex } from "styled-system/jsx";
import { Button } from "#/components/ui/button";
import { Sidebar } from "./Sidebar";

export function HomeTab() {
  return (
    <Flex gap="2">
      <Button
        onClick={() => {
          ipcRenderer.send("vn:overlay:open");
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
      <Sidebar />
    </Flex>
  );
}
