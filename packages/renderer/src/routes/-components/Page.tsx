import { For } from "solid-js";
import { Flex } from "styled-system/jsx";
import { Tabs } from "#/components/ui/tabs";
import { ConsoleTab } from "./ConsoleTab";
import { HomeTab } from "./HomeTab";

export function Page() {
  const options = [
    { id: "home", label: "Home" },
    { id: "console", label: "Console" },
  ];

  return (
    <Flex
      bg="bg.default"
      color="fg.default"
      minH="screen"
      pt="2"
      fontFamily="nunito"
    >
      <Tabs.Root defaultValue="home">
        <Tabs.List>
          <For each={options}>
            {(option) => (
              <Tabs.Trigger value={option.id}>{option.label}</Tabs.Trigger>
            )}
          </For>
          <Tabs.Indicator />
        </Tabs.List>
        <Tabs.Content
          value="home"
          px="2"
          style={{
            height: "calc(100vh - 56px)",
          }}
        >
          <HomeTab />
        </Tabs.Content>
        <Tabs.Content
          value="console"
          px="2"
          style={{
            height: "calc(100vh - 56px)",
          }}
          class="console-scrollbar"
        >
          <ConsoleTab />
        </Tabs.Content>
      </Tabs.Root>
    </Flex>
  );
}
