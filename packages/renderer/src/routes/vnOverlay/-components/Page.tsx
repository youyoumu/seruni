import { createEffect, createSignal, onMount } from "solid-js";
import "./Page.css";

import { FloatingPanel } from "@ark-ui/solid/floating-panel";
import { Portal } from "solid-js/web";
import { css } from "styled-system/css";
import { Box } from "styled-system/jsx";
import { fonts, loadGoogleFont } from "./utils/fonts";

export function Page() {
  const [text, setText] = createSignal("");

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
      style={{
        "border-color": windowColor(),
      }}
      hidden={!ready()}
    >
      <Box
        style={{
          "background-color": windowColor(),
        }}
        class="draggable"
        h="4"
        w="4"
      ></Box>
      <FloatingPanel.Root
        minSize={{ width: 100, height: 100 }}
        defaultOpen={true}
        allowOverflow={false}
      >
        <Portal>
          <FloatingPanel.Positioner>
            <FloatingPanel.Content
              class={css({
                display: "flex",
                flexDirection: "column",
              })}
            >
              <FloatingPanel.DragTrigger
                style={{
                  "background-color": windowColor(),
                }}
              >
                <FloatingPanel.Header
                  class={css({
                    display: "flex",
                    justifyContent: "end",
                    h: "4",
                  })}
                ></FloatingPanel.Header>
              </FloatingPanel.DragTrigger>

              <FloatingPanel.Body
                style={{
                  "background-color": backgroundColor(),
                }}
                class={css({
                  w: "full",
                  h: "full",
                })}
              >
                <Box
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
                </Box>
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
        </Portal>
      </FloatingPanel.Root>
    </Box>
  );
}
