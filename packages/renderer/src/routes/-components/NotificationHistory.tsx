import { XIcon } from "lucide-solid";
import { For } from "solid-js";
import { cva } from "styled-system/css";
import { HStack, Stack } from "styled-system/jsx";
import { Button } from "#/components/ui/button";
import { Drawer } from "#/components/ui/drawer";
import { IconButton } from "#/components/ui/icon-button";
import { Text } from "#/components/ui/text";
import { store } from "#/lib/store";
import { type AppToastType, ToasterIcon } from "./AppToaster";

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

export function NotificationHistory(props: Drawer.RootProps) {
  return (
    <Drawer.Root {...props}>
      <Drawer.Trigger
        asChild={(triggerProps) => (
          <Button {...triggerProps()}>Open Drawer</Button>
        )}
      />
      <Drawer.Backdrop />
      <Drawer.Positioner>
        <Drawer.Content>
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
            <For each={store.notifications}>
              {(item) => {
                return (
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
                    >
                      <XIcon />
                    </IconButton>
                  </Stack>
                );
              }}
            </For>
          </Drawer.Body>
          <Drawer.Footer gap="3">
            <Drawer.CloseTrigger
              asChild={(closeProps) => (
                <Button {...closeProps()} variant="outline">
                  Close
                </Button>
              )}
            />
            <Button>Clear</Button>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer.Positioner>
    </Drawer.Root>
  );
}
