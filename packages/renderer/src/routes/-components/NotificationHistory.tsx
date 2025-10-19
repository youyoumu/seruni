import { XIcon } from "lucide-solid";
import { type Component, For, Show } from "solid-js";
import { Portal } from "solid-js/web";
import { cva } from "styled-system/css";
import { HStack, Stack } from "styled-system/jsx";
import { Button } from "#/components/ui/button";
import { Drawer } from "#/components/ui/drawer";
import { IconButton } from "#/components/ui/icon-button";
import { Text } from "#/components/ui/text";
import { setStore, store } from "#/lib/store";
import { type AppToastType, appToaster, ToasterIcon } from "./AppToaster";

const notificationCard = cva({
  base: {
    borderWidth: "thin",
    borderLeftWidth: "medium",
    p: "4",
    rounded: "md",
    position: "relative",
    shadow: "sm",
  },
  variants: {
    type: {
      info: {
        borderLeftColor: "fg.default",
      },
      error: {
        borderLeftColor: "fg.error",
      },
      warning: {
        borderLeftColor: "yellow.light.a10",
      },
      success: {
        borderLeftColor: "grass.dark.a10",
      },
      loading: {
        borderLeftColor: "fg.subtle",
      },
    },
  },
});

export function NotificationHistory(props: { trigger: Component }) {
  const Trigger = props.trigger;
  const height = () => `calc(100vh - ${store.element.statusBar.height}px)`;

  return (
    <Drawer.Root
      onOpenChange={(details) => {
        if (details.open) {
          appToaster.original.getVisibleToasts().forEach((toast) => {
            appToaster.original.update(toast.id ?? "", {
              duration: 0,
            });
          });
        }
      }}
    >
      <Drawer.Trigger
        asChild={(triggerProps) => <Trigger {...triggerProps()}></Trigger>}
      />
      <Portal mount={document.querySelector("#app") ?? document.body}>
        <Drawer.Backdrop
          style={{
            height: height(),
          }}
        />
        <Drawer.Positioner
          style={{
            height: height(),
          }}
        >
          <Drawer.Content boxShadow="[none]">
            <Drawer.Header>
              <Drawer.Title>Notification</Drawer.Title>
              <Drawer.Description>
                Notification history and status updates.
              </Drawer.Description>
              <Drawer.CloseTrigger
                position="absolute"
                top="3"
                right="4"
                asChild={(closeProps) => (
                  <IconButton {...closeProps()} variant="ghost">
                    <XIcon />
                  </IconButton>
                )}
              />
            </Drawer.Header>
            <Drawer.Body gap="4" class="custom-scrollbar">
              <For each={[...store.notifications].reverse()}>
                {(item) => {
                  return (
                    <Show when={item.id}>
                      <Stack
                        class={notificationCard({
                          type: item.type as AppToastType,
                        })}
                      >
                        <HStack alignItems="start">
                          <ToasterIcon type={item.type as AppToastType} />
                          <Stack>
                            <Text>{item.title}</Text>
                            <Text size="sm" color="fg.muted">
                              {item.description}
                            </Text>
                          </Stack>
                        </HStack>
                        <IconButton
                          size="sm"
                          variant="link"
                          position="absolute"
                          top="3"
                          right="3"
                          onClick={() => {
                            const notificationIndex =
                              store.notifications.findIndex(
                                (notification) => notification.id === item.id,
                              );
                            setStore("notifications", notificationIndex, {
                              id: undefined,
                              title: undefined,
                              description: undefined,
                              type: "info",
                            });
                          }}
                        >
                          <XIcon />
                        </IconButton>
                      </Stack>
                    </Show>
                  );
                }}
              </For>
            </Drawer.Body>
            <Drawer.Footer gap="3">
              <Drawer.CloseTrigger
                flex="1"
                asChild={(closeProps) => (
                  <Button {...closeProps()} variant="outline">
                    Close
                  </Button>
                )}
              />
              <Button
                flex="1"
                onClick={() => {
                  setStore("notifications", []);
                }}
              >
                Clear
              </Button>
            </Drawer.Footer>
          </Drawer.Content>
        </Drawer.Positioner>
      </Portal>
    </Drawer.Root>
  );
}
