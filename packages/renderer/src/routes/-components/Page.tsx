import { For, onMount } from "solid-js";
import { Flex } from "styled-system/jsx";
import { Tabs } from "#/components/ui/tabs";
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

  onMount(() => {
    ipcRenderer.send("general:ready");
  });

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
        >
          <ConsoleTab />
        </Tabs.Content>
        <Tabs.Content
          value="settings"
          px="4"
          style={{
            height: "calc(100vh - 64px)",
          }}
        >
          <SettingsTab />
        </Tabs.Content>
      </Tabs.Root>
      <AppToaster />
    </Flex>
  );
}
