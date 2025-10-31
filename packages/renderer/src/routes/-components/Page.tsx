import type {
  ToastPromiseOptionsError,
  ToastPromiseOptionsSuccess,
} from "@repo/preload/ipc";
import { createElementSize } from "@solid-primitives/resize-observer";
import { ShellIcon, XIcon } from "lucide-solid";
import { css, cva } from "styled-system/css";
import { HStack, Stack } from "styled-system/jsx";
import { Button } from "#/components/ui/button";
import { IconButton } from "#/components/ui/icon-button";
import { Tabs } from "#/components/ui/tabs";
import { Text } from "#/components/ui/text";
import { Toast } from "#/components/ui/toast";
import { localStore, setLocalStore, store } from "#/lib/store";
import { type AppToastType, appToaster, ToasterIcon } from "./AppToaster";
import { ConsoleTab } from "./ConsoleTab";
import { DebugTab } from "./DebugTab";
import { HistoryTab } from "./HistoryTab";
import { HomeTab } from "./HomeTab";
import { MiningTab } from "./MiningTab";
import { SettingsTab } from "./SettingsTab";
import { StatusBar } from "./StatusBar";

const options = [
  { id: "home", label: "Home" },
  { id: "mining", label: "Mining" },
  { id: "history", label: "History" },
  { id: "console", label: "Console" },
  { id: "settings", label: "Settings" },
];
if (import.meta.env.DEV) {
  options.push({ id: "debug", label: "Debug" });
}

export function Page() {
  const [tabListEl, setTabListEl] = createSignal<HTMLDivElement>();
  const [statusBarEl] = store.element.statusBar;
  const tabListSize = createElementSize(tabListEl);
  const statusBarSize = createElementSize(statusBarEl);
  const contentHeight = (gap = 8) => {
    return `calc(100vh - ${(tabListSize.height ?? 0) + (statusBarSize.height ?? 0) + gap}px)`;
  };

  createEffect(() => {});

  onMount(() => {
    ipcRenderer.send("general:ready");
  });

  return (
    <Suspense
      fallback={
        <Stack h="screen" w="full" alignItems="center" justifyContent="center">
          <ShellIcon
            strokeWidth="1"
            size="100"
            class={css({
              color: "fg.muted",
              animationName: "spin",
              animationDuration: "slowest",
              animationIterationCount: "infinite",
              animationTimingFunction: "pulse",
              animationDirection: "reverse",
            })}
          />
          <Text color="fg.muted" size="xl">
            Loading...
          </Text>
        </Stack>
      }
    >
      <Tabs.Root
        value={localStore.currentTab}
        onValueChange={(details) => {
          setLocalStore("currentTab", details.value);
        }}
      >
        <Tabs.List
          px="2"
          pt="4"
          pb="2"
          ref={setTabListEl}
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
        <Tabs.Content
          value="debug"
          px="4"
          style={{
            height: contentHeight(16),
          }}
        >
          <DebugTab />
        </Tabs.Content>
      </Tabs.Root>
      <AppToaster />
      <StatusBar />
    </Suspense>
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
            result.success
              ? {
                  title: result.success.title,
                  description: result.success.description,
                  action: (() => {
                    const label = result.success?.action?.label;
                    const id = result.success?.action?.id;
                    if (label && id) {
                      return {
                        label,
                        onClick: () => {
                          ipcRenderer.send("log:invokeAction", { id });
                        },
                      };
                    }
                    return undefined;
                  })(),
                }
              : {
                  title: "Unknown Success",
                },
        },
      );
    });
  });

  return (
    <Toast.Toaster toaster={appToaster.original}>
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
