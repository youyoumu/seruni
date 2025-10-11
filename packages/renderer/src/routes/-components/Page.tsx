import {
  CheckIcon,
  InfoIcon,
  OctagonXIcon,
  ShieldAlertIcon,
  XIcon,
} from "lucide-solid";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  Match,
  onMount,
  Switch,
} from "solid-js";
import { css, cva } from "styled-system/css";
import { HStack, Stack } from "styled-system/jsx";
import { Button } from "#/components/ui/button";
import { Icon } from "#/components/ui/icon";
import { IconButton } from "#/components/ui/icon-button";
import { Spinner } from "#/components/ui/spinner";
import { Tabs } from "#/components/ui/tabs";
import { Toast } from "#/components/ui/toast";
import { appToaster, type ToastType } from "./AppToaster";
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
  return (
    <Toast.Toaster toaster={appToaster}>
      {(toast) => {
        const type = createMemo(() => toast().type) as () => ToastType;
        return (
          <Toast.Root class={toasterRoot({ type: type() })}>
            <HStack>
              <Switch>
                <Match when={type() === "info"}>
                  <Icon asChild={(props) => <InfoIcon {...props()} />} />
                </Match>

                <Match when={type() === "error"}>
                  <Icon
                    class={css({ color: "fg.error" })}
                    asChild={(props) => <OctagonXIcon {...props()} />}
                  />
                </Match>

                <Match when={type() === "warning"}>
                  <Icon
                    class={css({ color: "yellow.dark.a10" })}
                    asChild={(props) => <ShieldAlertIcon {...props()} />}
                  />
                </Match>

                <Match when={type() === "success"}>
                  <Icon
                    class={css({ color: "grass.dark.a10" })}
                    asChild={(props) => <CheckIcon {...props()} />}
                  />
                </Match>

                <Match when={type() === "loading"}>
                  <Icon
                    asChild={(props) => (
                      <Spinner borderColor="fg.subtle" {...props()} />
                    )}
                  />
                </Match>
              </Switch>

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
