import { XIcon } from "lucide-solid";
import { For } from "solid-js";
import { Flex } from "styled-system/jsx";
import { Button } from "#/components/ui/button";
import { IconButton } from "#/components/ui/icon-button";
import { Tabs } from "#/components/ui/tabs";
import { Toast } from "#/components/ui/toast";
import { AppToaster } from "./AppToaster";
import { ConsoleTab } from "./ConsoleTab";
import { HomeTab } from "./HomeTab";
import { MiningTab } from "./MiningTab";
import { SettingsTab } from "./SettingsTab";

export function Page() {
  const options = [
    { id: "home", label: "Home" },
    { id: "mining", label: "Mining" },
    { id: "console", label: "Console" },
    { id: "settings", label: "Settings" },
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
        <Tabs.List px="2">
          <For each={options}>
            {(option) => (
              <Tabs.Trigger value={option.id}>{option.label}</Tabs.Trigger>
            )}
          </For>
          <Tabs.Indicator />
        </Tabs.List>
        <Tabs.Content
          value="home"
          px="4"
          style={{
            height: "calc(100vh - 56px)",
          }}
        >
          <HomeTab />
        </Tabs.Content>
        <Tabs.Content
          value="mining"
          px="4"
          style={{
            height: "calc(100vh - 64px)",
          }}
        >
          <MiningTab />
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
        <Tabs.Content
          value="settings"
          px="4"
          style={{
            height: "calc(100vh - 56px)",
          }}
        >
          <SettingsTab />
        </Tabs.Content>
      </Tabs.Root>
      <AppToaster />
    </Flex>
  );
}
