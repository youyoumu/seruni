import { createSignal, type JSX, type ParentProps, Show } from "solid-js";
import { Portal } from "solid-js/web";
import { css } from "styled-system/css";
import { Box, HStack, Stack } from "styled-system/jsx";
import { Button } from "#/components/ui/button";
import { Dialog } from "#/components/ui/dialog";
import { PictureCropper } from "./PictureCropper";

export function PictureWithZoom(props: {
  src: string;
  trigger: (props: () => ParentProps) => JSX.Element;
}) {
  const [editing, setEditing] = createSignal(false);

  return (
    <Dialog.Root>
      <Dialog.Trigger
        asChild={(triggerProps) => {
          return props.trigger(triggerProps);
        }}
      />
      <Dialog.Backdrop />
      <Portal mount={document.querySelector("#app") ?? document.body}>
        <Dialog.Positioner>
          <Dialog.Content
            p="4"
            bg="transparent"
            boxShadow="[none]"
            outlineStyle="[none]"
            display="flex"
            flexDirection="column"
            gap="4"
          >
            <Dialog.CloseTrigger
              asChild={(closeTriggerProps) => (
                <Stack>
                  <Show when={!editing()}>
                    <img
                      {...closeTriggerProps()}
                      class={css({
                        w: "full",
                        maxW: "8xl",
                        objectFit: "contain",
                        rounded: "md",
                        shadow: "md",
                      })}
                      src={props.src}
                      alt="PictureField"
                    />
                  </Show>

                  <Box maxW="8xl" hidden={!editing()}>
                    <PictureCropper src={props.src} editing={editing()} />
                  </Box>

                  <HStack justifyContent="end" px="8">
                    <Button
                      {...closeTriggerProps()}
                      opacity="0"
                      flex="1"
                      cursor="default"
                    >
                      ""
                    </Button>
                    <Show when={editing()}>
                      <Button
                        onClick={() => {
                          setEditing(false);
                        }}
                      >
                        Cancel
                      </Button>
                      <Button onClick={() => {}}>Save</Button>
                    </Show>
                    <Show when={!editing()}>
                      <Button
                        onClick={() => {
                          setEditing(true);
                        }}
                      >
                        Crop
                      </Button>
                    </Show>
                  </HStack>
                </Stack>
              )}
            />
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
