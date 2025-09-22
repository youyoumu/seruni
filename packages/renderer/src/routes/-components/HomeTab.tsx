import { Flex } from "styled-system/jsx";
import { Button } from "#/components/ui/button";
import { Sidebar } from "./Sidebar";

export function HomeTab() {
  return (
    <Flex gap="2">
      <Button>Open VN Overlay</Button>
      <Sidebar />
    </Flex>
  );
}
