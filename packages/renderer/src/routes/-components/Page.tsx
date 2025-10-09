import { createEffect, createSignal, For, onMount } from "solid-js";
import { css } from "styled-system/css";
import { HStack } from "styled-system/jsx";
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

  let tabListRef: HTMLDivElement | undefined;
  const [tabListHeight, setTabListHeight] = createSignal(0);
  const contentHeight = (gap = 8) => `calc(100vh - ${tabListHeight() + gap}px)`;

  createEffect(() => {
    // console.log(tabListHeight());
  });

  onMount(() => {
    setTabListHeight(tabListRef?.clientHeight ?? 0);
    tabListRef?.addEventListener("resize", () => {
      setTabListHeight(tabListRef?.clientHeight ?? 0);
    });
  });

  return (
    <>
      <Tabs.Root defaultValue="home">
        <Tabs.List
          px="2"
          pt="4"
          pb="2"
          ref={tabListRef}
          justifyContent="center"
        >
          <HStack maxW="8xl" w="full">
            <For each={options}>
              {(option) => (
                <Tabs.Trigger
                  value={option.id}
                  class={css({
                    fontSize: "lg",
                  })}
                >
                  {option.label}
                </Tabs.Trigger>
              )}
            </For>
          </HStack>

          <Tabs.Indicator />
        </Tabs.List>
        <Tabs.Content
          value="home"
          px="4"
          style={{
            height: contentHeight(),
          }}
        >
          <HomeTab />
        </Tabs.Content>
        <Tabs.Content
          value="mining"
          px="4"
          style={{
            height: contentHeight(16),
          }}
        >
          <MiningTab />
        </Tabs.Content>
        <Tabs.Content
          value="console"
          px="2"
          style={{
            height: contentHeight(),
          }}
        >
          <ConsoleTab />
        </Tabs.Content>
        <Tabs.Content
          value="settings"
          px="4"
          style={{
            height: contentHeight(16),
          }}
        >
          <SettingsTab />
        </Tabs.Content>
      </Tabs.Root>
      <AppToaster />
    </>
  );
}
