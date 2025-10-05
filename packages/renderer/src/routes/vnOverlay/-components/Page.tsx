import { createEffect, createSignal, onMount } from "solid-js";
import "./Page.css";
import { Settings } from "lucide-solid";
import { css } from "styled-system/css";
import { Box } from "styled-system/jsx";
import { fonts, loadGoogleFont } from "./utils/fonts";

export function Page() {
  const [text, setText] = createSignal("");
  const [showSettings, setShowSettings] = createSignal(false);

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
      h="svh"
      w="full"
      hidden={!ready()}
      borderWidth="thin"
      _hover={{
        "& #settings": { opacity: 100 },
        "& #gear": { opacity: 100 },
      }}
      style={{
        "border-color": windowColor(),
      }}
    >
      <Box
        h="4" // 1rem if using default scale
        w="full" // 100%
        bg="white"
        cursor="grab"
        style={{ "background-color": windowColor() }}
        class="draggable"
      />

      <Box
        overflow="hidden"
        pos="relative"
        w="full"
        h="[calc(100% - 16px)]"
        style={{ "background-color": backgroundColor() }}
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
      </Box>

      <Settings
        id="gear"
        class={css({
          pos: "absolute",
          bottom: "3",
          right: "3",
          h: "6",
          w: "6",
          cursor: "pointer",
          opacity: 0,
        })}
        style={{
          color: windowColor(),
        }}
        onClick={() => {
          setShowSettings(!showSettings());
        }}
      />

      <Box
        pos="absolute"
        bottom="0"
        right="0"
        h="4"
        w="4"
        borderRightWidth="4"
        borderBottomWidth="4"
        style={{
          "border-color": windowColor(),
        }}
      ></Box>
    </Box>
  );
}
