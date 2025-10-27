import { parseColor } from "@ark-ui/solid";
import { PipetteIcon } from "lucide-solid";
import { Grid, HStack, Stack } from "styled-system/jsx";
import { Select_ } from "#/components/Form";
import { ColorPicker } from "#/components/ui/color-picker";
import { Heading } from "#/components/ui/heading";
import { IconButton } from "#/components/ui/icon-button";
import { Input } from "#/components/ui/input";
import { NumberInput } from "#/components/ui/number-input";
import { createListCollection } from "#/components/ui/select";
import { Text } from "#/components/ui/text";

const fonts = [
  "Noto Sans JP",
  "Noto Serif JP",
  "Kosugi Maru",
  "M PLUS Rounded 1c",
  "Sawarabi Mincho",
];

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function VnOverlay() {
  const [opacity, setOpacity] = createSignal(1);
  const [windowColor, setWindowColor] = createSignal(parseColor("#ffffff"));
  const [backgroundColor, setBackgroundColor] = createSignal(
    parseColor("#000000"),
  );
  const [textColor, setTextColor] = createSignal(parseColor("#ffffff"));
  const [fontSize, setFontSize] = createSignal(24);
  const [fontWeight, setFontWeight] = createSignal(400);
  const [font, setFont] = createSignal(fonts[0]);

  let ready = false;
  createEffect(() => {
    const payload = {
      windowColor: windowColor().toString("hexa"),
      backgroundColor: backgroundColor().toString("hexa"),
      textColor: textColor().toString("hexa"),
      fontSize: clamp(fontSize(), 1, 99),
      fontWeight: clamp(fontWeight(), 100, 900),
      font: font() ?? "",
      opacity: opacity(),
    };
    if (!ready) return;
    ipcRenderer.send("settings:setVnOverlaySettings", payload);
  });

  onMount(async () => {
    const settings = (await ipcRenderer.invoke("settings:getConfig")).window
      .vn_overlay;

    setOpacity(settings.opacity);
    setWindowColor(parseColor(settings.windowColor));
    setBackgroundColor(parseColor(settings.backgroundColor));
    setTextColor(parseColor(settings.textColor));
    setFontSize(settings.fontSize);
    setFontWeight(settings.fontWeight);
    setFont(settings.font);

    ready = true;
  });

  return (
    <Stack gap="4" w="full">
      <Stack>
        <Heading
          size="2xl"
          borderBottomColor="border.default"
          borderBottomWidth="medium"
          pb="2"
        >
          VN Overlay
        </Heading>
      </Stack>
      <Grid gap="2" gridTemplateColumns="repeat(auto-fit, minmax(200px, 1fr))">
        <Select_
          label="Font"
          placeholder="Select a Font"
          value={[font() ?? ""]}
          collection={createListCollection({
            items: fonts.map((font) => ({
              label: font,
              value: font,
            })),
          })}
          onValueChange={(e) => {
            setFont(e.items[0]?.value);
          }}
        ></Select_>
        <NumberInput
          value={fontSize().toString()}
          clampValueOnBlur
          onValueChange={(e) => {
            setFontSize(e.valueAsNumber);
          }}
          min={1}
          max={99}
          step={0.1}
        >
          Font Size
        </NumberInput>
        <NumberInput
          value={fontWeight().toString()}
          clampValueOnBlur
          onValueChange={(e) => {
            setFontWeight(e.valueAsNumber);
          }}
          min={100}
          max={900}
          step={100}
        >
          Font Weight
        </NumberInput>
        <NumberInput
          value={opacity().toString()}
          clampValueOnBlur
          onValueChange={(e) => {
            setOpacity(e.valueAsNumber);
          }}
          min={0.05}
          max={1}
          step={0.05}
        >
          Opacity
        </NumberInput>
        <ColorPicker_
          value={windowColor()}
          onValueChange={(e) => {
            if (e.value.getChannelValue("alpha") === 0) {
              setWindowColor(e.value.withChannelValue("alpha", 0.01));
            } else {
              setWindowColor(e.value);
            }
          }}
          label="Window Color"
        />

        <ColorPicker_
          value={backgroundColor()}
          onValueChange={(e) => {
            if (e.value.getChannelValue("alpha") === 0) {
              setBackgroundColor(e.value.withChannelValue("alpha", 0.01));
            } else {
              setBackgroundColor(e.value);
            }
          }}
          label="Background Color"
        />

        <ColorPicker_
          value={textColor()}
          onValueChange={(e) => {
            if (e.value.getChannelValue("alpha") === 0) {
              setTextColor(e.value.withChannelValue("alpha", 0.01));
            } else {
              setTextColor(e.value);
            }
          }}
          label="Text Color"
        />
      </Grid>
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
