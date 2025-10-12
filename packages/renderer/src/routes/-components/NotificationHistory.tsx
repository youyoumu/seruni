import { XIcon } from "lucide-solid";
import { For } from "solid-js";
import { cva } from "styled-system/css";
import { HStack, Stack } from "styled-system/jsx";
import { Button } from "#/components/ui/button";
import { Drawer } from "#/components/ui/drawer";
import { IconButton } from "#/components/ui/icon-button";
import { Text } from "#/components/ui/text";
import { ToasterIcon } from "./AppToaster";

const notifications = [
  {
    id: 1,
    title: "Notification 1",
    description:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Praesent eget suscipit lorem. Nulla facilisi. Donec auctor, justo sed feugiat interdum, sem orci tincidunt elit, nec volutpat libero enim vel risus.",
    type: "info",
  },
  {
    id: 2,
    title: "Notification 2",
    description:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Morbi in ex nec neque tincidunt faucibus. Sed eu nisi nec justo blandit ultrices vel a orci. Nam ut semper ante, ac vulputate erat.",
    type: "success",
  },
  {
    id: 3,
    title: "Notification 3",
    description:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Ut id tellus eu eros aliquam ullamcorper. Suspendisse potenti. Proin euismod, leo a porttitor maximus, mi lorem efficitur risus, nec porttitor mi est eget nulla.",
    type: "warning",
  },
  {
    id: 4,
    title: "Notification 4",
    description:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer vel elit vel neque fringilla interdum. Pellentesque euismod, metus sed finibus dignissim, eros neque interdum mauris, vitae placerat est lacus ac sapien.",
    type: "error",
  },
  {
    id: 5,
    title: "Notification 5",
    description:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Maecenas dignissim sapien nec nunc sagittis, at facilisis mi efficitur. Sed a felis eget justo iaculis tincidunt ut at risus.",
    type: "loading",
  },
  {
    id: 6,
    title: "Notification 6",
    description:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nam eget nulla nec urna fermentum tempus. In a magna vitae arcu interdum tristique. Suspendisse eget sem at lacus consectetur finibus.",
    type: "info",
  },
  {
    id: 7,
    title: "Notification 7",
    description:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aliquam congue, sapien vel commodo venenatis, ipsum purus maximus velit, et facilisis justo enim eget nulla. Integer id sapien ac nisi sodales ultricies.",
    type: "warning",
  },
  {
    id: 8,
    title: "Notification 8",
    description:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Phasellus non magna non orci tincidunt euismod. Sed dictum, sapien nec hendrerit fermentum, metus dolor gravida justo, eget aliquet erat lacus at nibh.",
    type: "success",
  },
] as const;

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
            <For each={notifications}>
              {(item) => {
                return (
                  <Stack class={notificationCard({ type: item.type })}>
                    <HStack alignItems="start">
                      <ToasterIcon type={item.type} />
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
