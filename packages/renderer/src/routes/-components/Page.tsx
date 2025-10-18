import type {
  ToastPromiseOptions,
  ToastPromiseOptionsError,
  ToastPromiseOptionsSuccess,
} from "@repo/preload/ipc";
import { XIcon } from "lucide-solid";
import { createEffect, createMemo, createSignal, For, onMount } from "solid-js";
import { css, cva } from "styled-system/css";
import { HStack, Stack } from "styled-system/jsx";
import { Button } from "#/components/ui/button";
import { IconButton } from "#/components/ui/icon-button";
import { Tabs } from "#/components/ui/tabs";
import { Toast } from "#/components/ui/toast";
import { setStore, store } from "#/lib/store";
import {
  type AppToastType,
  appToaster,
  appToaster_,
  ToasterIcon,
} from "./AppToaster";
import { ConsoleTab } from "./ConsoleTab";
import { HistoryTab } from "./HistoryTab";
import { HomeTab } from "./HomeTab";
import { MiningTab } from "./MiningTab";
import { SettingsTab } from "./SettingsTab";
import { StatusBar } from "./StatusBar";

export function Page() {
  const options = [
    { id: "home", label: "Home" },
    { id: "mining", label: "Mining" },
    { id: "history", label: "History" },
    { id: "console", label: "Console" },
    { id: "settings", label: "Settings" },
  ];

  onMount(() => {
    ipcRenderer.send("general:ready");
  });

  let tabListRef: HTMLDivElement | undefined;
  const [tabListHeight, setTabListHeight] = createSignal(0);
  const contentHeight = (gap = 8) =>
    `calc(100vh - ${tabListHeight() + store.element.statusBar.height + gap}px)`;

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
      <Tabs.Root
        defaultValue="home"
        onValueChange={(details) => {
          setStore("general", "currentTab", details.value);
        }}
      >
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
          value="history"
          px="4"
          style={{
            height: contentHeight(16),
          }}
        >
          <HistoryTab />
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
      <StatusBar />
    </>
  );
}

const toasterRoot = cva({
  base: {
    borderLeftWidth: "medium",
  },
  variants: {
    type: {
      info: {
        borderColor: "fg.default",
      },
      error: {
        borderColor: "fg.error",
      },
      warning: {
        borderColor: "yellow.light.a10",
      },
      success: {
        borderColor: "grass.dark.a10",
      },
      loading: {
        borderColor: "fg.subtle",
      },
    },
  },
});

export function AppToaster() {
  onMount(() => {
    ipcRenderer.on("log:toast", ({ title, description, type }) => {
      appToaster.create({
        title,
        description,
        type,
      });
    });

    ipcRenderer.on("log:toastPromise", ({ loading, uuid }) => {
      let result: Partial<ToastPromiseOptionsSuccess> &
        Partial<ToastPromiseOptionsError>;
      appToaster.promise(
        async () => {
          result = await ipcRenderer.invoke("log:toastPromise", { uuid });
          if (result.error) {
            throw new Error(result.error?.description ?? "Unknown error");
          }
        },
        {
          loading,
          error: () =>
            result.error ?? {
              title: "Unknown Error",
            },
          success: () =>
            result.success ?? {
              title: "Unknown Success",
            },
        },
      );
    });
  });

  return (
    <Toast.Toaster toaster={appToaster_}>
      {(toast) => {
        const type = createMemo(() => toast().type) as () => AppToastType;
        return (
          <Toast.Root class={toasterRoot({ type: type() })}>
            <HStack>
              <ToasterIcon type={type()} />
              <Stack gap="0" alignItems="start">
                <Toast.Title>{toast().title}</Toast.Title>
                <Toast.Description>{toast().description}</Toast.Description>
                <Toast.ActionTrigger
                  asChild={(actionProps) => (
                    <Button {...actionProps()} variant="link" size="sm">
                      {toast().action?.label}
                    </Button>
                  )}
                />
              </Stack>
            </HStack>
            <Toast.CloseTrigger
              asChild={(closeProps) => (
                <IconButton {...closeProps()} size="sm" variant="link">
                  <XIcon />
                </IconButton>
              )}
            />
          </Toast.Root>
        );
      }}
    </Toast.Toaster>
  );
}
