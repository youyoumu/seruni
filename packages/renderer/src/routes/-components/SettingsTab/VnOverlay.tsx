import { parseColor } from "@ark-ui/solid";
import { PipetteIcon } from "lucide-solid";
import { createEffect, createSignal, For } from "solid-js";
import { Box, Flex, HStack, Stack } from "styled-system/jsx";
import { Button } from "#/components/ui/button";
import { ColorPicker } from "#/components/ui/color-picker";
import { Heading } from "#/components/ui/heading";
import { IconButton } from "#/components/ui/icon-button";
import { Input } from "#/components/ui/input";
import { Text } from "#/components/ui/text";

const fonts = [
  "Noto Sans JP",
  "Noto Serif JP",
  "Kosugi Maru",
  "M PLUS Rounded 1c",
  "Sawarabi Mincho",
];

export function VnOverlay() {
  const defaultWindowColor = parseColor("#ffffff");
  const defaultBackgroundColor = parseColor("#000000");
  const defaultTextColor = parseColor("#ffffff");
  const defaultFontSize = 24;
  const defaultFontWeight = 400;

  const [windowColor, setWindowColor] = createSignal(parseColor("#ffffff"));
  const [backgroundColor, setBackgroundColor] = createSignal(
    parseColor("#000000"),
  );
  const [textColor, setTextColor] = createSignal(parseColor("#ffffff"));
  const [fontSize, setFontSize] = createSignal(defaultFontSize);
  const [fontWeight, setFontWeight] = createSignal(defaultFontWeight);
  const [font, setFont] = createSignal(fonts[0]);

  // guard to make sure the color is not fully transparent
  createEffect(() => {
    if (windowColor().getChannelValue("alpha") === 0) {
      setWindowColor(windowColor().withChannelValue("alpha", 0.01));
    }
    if (backgroundColor().getChannelValue("alpha") === 0) {
      setBackgroundColor(backgroundColor().withChannelValue("alpha", 0.01));
    }
    if (textColor().getChannelValue("alpha") === 0) {
      setTextColor(textColor().withChannelValue("alpha", 0.01));
    }
  });

  createEffect(() => {
    console.log(textColor().toString("hex"));
  });

  return (
    <Stack gap="2" w="full">
      <Heading size="2xl">VN Overlay Settings</Heading>
      <Box borderBottomColor="border.default" borderBottomWidth="medium"></Box>
      <Flex gap="2">
        <ColorPicker_
          value={windowColor()}
          onValueChange={(e) => {
            setWindowColor(e.value);
          }}
          label="Window Color"
        />

        <ColorPicker_
          value={backgroundColor()}
          onValueChange={(e) => {
            setBackgroundColor(e.value);
          }}
          label="Background Color"
        />

        <ColorPicker_
          value={textColor()}
          onValueChange={(e) => {
            setTextColor(e.value);
          }}
          label="Text Color"
        />
      </Flex>
    </Stack>
  );
}

export const ColorPicker_ = (
  props: ColorPicker.RootProps & { label: string },
) => {
  return (
    <ColorPicker.Root {...props}>
      <ColorPicker.Context>
        {(api) => (
          <>
            <ColorPicker.Label>{props.label}</ColorPicker.Label>
            <ColorPicker.Control>
              <ColorPicker.ChannelInput
                channel="hex"
                asChild={(inputProps) => <Input {...inputProps()} />}
              />
              <ColorPicker.Trigger
                asChild={(triggerProps) => (
                  <IconButton variant="outline" {...triggerProps()}>
                    <ColorPicker.Swatch value={api().value} />
                  </IconButton>
                )}
              />
            </ColorPicker.Control>
            <ColorPicker.Positioner>
              <ColorPicker.Content>
                <Stack gap="3">
                  <ColorPicker.Area>
                    <ColorPicker.AreaBackground />
                    <ColorPicker.AreaThumb />
                  </ColorPicker.Area>
                  <HStack gap="3">
                    <ColorPicker.EyeDropperTrigger
                      asChild={(triggerProps) => (
                        <IconButton
                          size="xs"
                          variant="outline"
                          aria-label="Pick a color"
                          {...triggerProps()}
                        >
                          <PipetteIcon />
                        </IconButton>
                      )}
                    />
                    <Stack gap="2" flex="1">
                      <ColorPicker.ChannelSlider channel="hue">
                        <ColorPicker.ChannelSliderTrack />
                        <ColorPicker.ChannelSliderThumb />
                      </ColorPicker.ChannelSlider>
                      <ColorPicker.ChannelSlider channel="alpha">
                        <ColorPicker.TransparencyGrid size="8px" />
                        <ColorPicker.ChannelSliderTrack />
                        <ColorPicker.ChannelSliderThumb />
                      </ColorPicker.ChannelSlider>
                    </Stack>
                  </HStack>
                  <HStack>
                    <ColorPicker.ChannelInput
                      channel="hex"
                      asChild={(inputProps) => (
                        <Input size="2xs" {...inputProps()} />
                      )}
                    />
                    <ColorPicker.ChannelInput
                      channel="alpha"
                      asChild={(inputProps) => (
                        <Input size="2xs" {...inputProps()} />
                      )}
                    />
                  </HStack>
                  <Stack gap="1.5">
                    <Text size="xs" fontWeight="medium" color="fg.default">
                      Saved Colors
                    </Text>
                    <ColorPicker.SwatchGroup>
                      <For each={presets}>
                        {(color) => (
                          <ColorPicker.SwatchTrigger value={color}>
                            <ColorPicker.Swatch value={color} />
                          </ColorPicker.SwatchTrigger>
                        )}
                      </For>
                    </ColorPicker.SwatchGroup>
                  </Stack>
                </Stack>
              </ColorPicker.Content>
            </ColorPicker.Positioner>
          </>
        )}
      </ColorPicker.Context>
      <ColorPicker.HiddenInput />
    </ColorPicker.Root>
  );
};

const presets = [
  "hsl(10, 81%, 59%)",
  "hsl(60, 81%, 59%)",
  "hsl(100, 81%, 59%)",
  "hsl(175, 81%, 59%)",
  "hsl(190, 81%, 59%)",
  "hsl(205, 81%, 59%)",
  "hsl(220, 81%, 59%)",
  "hsl(250, 81%, 59%)",
  "hsl(280, 81%, 59%)",
  "hsl(350, 81%, 59%)",
];
