import { createEffect, createSignal, onMount } from "solid-js";
import "./Page.css";

import { FloatingPanel } from "@ark-ui/solid/floating-panel";
import { css } from "styled-system/css";
import { Box } from "styled-system/jsx";
import { Text } from "#/components/ui/text";
import { fonts, loadGoogleFont } from "./utils/fonts";

export function Page() {
  const [text, setText] = createSignal("おはよう、昨日はよく眠れた？");

  const defaultFontSize = 24;
  const defaultFontWeight = 400;
  const defaultWindowColor = "#ffffff";
  const defaultBackgroundColor = "#000000";
  const defaultTextColor = "#ffffff";

  const [windowColor, setWindowColor] = createSignal(defaultWindowColor);
  const [backgroundColor, setBackgroundColor] = createSignal(
    defaultBackgroundColor,
  );
  const [textColor, setTextColor] = createSignal(defaultTextColor);
  const [fontSize, setFontSize] = createSignal(defaultFontSize);
  const [fontWeight, setFontWeight] = createSignal(defaultFontWeight);
  const [font, setFont] = createSignal(fonts[0]);
  const [ready, setReady] = createSignal(false);

  createEffect(() => {
    loadGoogleFont(font(), [100, 200, 300, 400, 500, 600, 700, 800, 900]);
  });

  onMount(async () => {
    const settings = (await ipcRenderer.invoke("settings:getConfig"))?.window
      ?.vn_overlay;
    setWindowColor(settings?.windowColor ?? defaultWindowColor);
    setBackgroundColor(settings?.backgroundColor ?? defaultBackgroundColor);
    setTextColor(settings?.textColor ?? defaultTextColor);
    setFontSize(settings?.fontSize ?? defaultFontSize);
    setFontWeight(settings?.fontWeight ?? defaultFontWeight);
    setFont(settings?.font ?? fonts[0]);

    ipcRenderer.on("vnOverlay:setSettings", (payload) => {
      const settings = payload?.settings;
      settings?.windowColor && setWindowColor(settings.windowColor);
      settings?.backgroundColor && setBackgroundColor(settings.backgroundColor);
      settings?.textColor && setTextColor(settings.textColor);
      settings?.fontSize && setFontSize(settings.fontSize);
      settings?.fontWeight && setFontWeight(settings.fontWeight);
      settings?.font && setFont(settings.font);
    });

    ipcRenderer.on("vnOverlay:sendText", (payload) => {
      setText(payload?.text);
    });

    setReady(true);
  });

  return (
    <Box
      h="screen"
      w="full"
      borderWidth="thin"
      borderStyle="solid"
      borderColor="border.default"
      overflow="hidden"
      rounded="md"
      bg="bg.subtle"
      hidden={!ready()}
      opacity={{
        base: 0.5,
        _hover: 1,
      }}
      class="draggable"
    >
      <FloatingPanel.Root
        minSize={{ width: 100, height: 100 }}
        defaultOpen={true}
        allowOverflow={false}
      >
        <FloatingPanel.Positioner>
          <FloatingPanel.Content
            class={`${css({
              display: "flex",
              flexDirection: "column",
              borderWidth: "thin",
              borderStyle: "solid",
              borderColor: "border.default",
              shadow: "sm",
              rounded: "md",
              overflow: "hidden",
            })} not-draggable`}
          >
            <FloatingPanel.DragTrigger
              class={css({
                bg: "bg.emphasized",
                borderBottomWidth: "thin",
                borderStyle: "solid",
                borderColor: "border.default",
              })}
            >
              <FloatingPanel.Header
                class={css({
                  display: "flex",
                  justifyContent: "end",
                  h: "5",
                })}
              ></FloatingPanel.Header>
            </FloatingPanel.DragTrigger>

            <FloatingPanel.Body
              class={css({
                w: "full",
                h: "full",
                bg: "bg.default",
              })}
            >
              <Text
                as="p"
                style={{
                  "font-size": `${fontSize()}px`,
                  "font-weight": `${fontWeight()}`,
                  "font-family": `${font()}`,
                  color: textColor(),
                }}
                px="2"
              >
                {text()}
              </Text>
            </FloatingPanel.Body>

            <FloatingPanel.ResizeTrigger axis="n" />
            <FloatingPanel.ResizeTrigger axis="e" />
            <FloatingPanel.ResizeTrigger axis="w" />
            <FloatingPanel.ResizeTrigger axis="s" />
            <FloatingPanel.ResizeTrigger axis="ne" />
            <FloatingPanel.ResizeTrigger axis="se" />
            <FloatingPanel.ResizeTrigger axis="sw" />
            <FloatingPanel.ResizeTrigger axis="nw" />
          </FloatingPanel.Content>
        </FloatingPanel.Positioner>
      </FloatingPanel.Root>
    </Box>
  );
}
