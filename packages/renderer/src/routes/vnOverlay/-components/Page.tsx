import { createEffect, createSignal, onMount } from "solid-js";
import "./Page.css";
import { Settings } from "lucide-solid";
import { css } from "styled-system/css";
import { Box } from "styled-system/jsx";
import { fonts, loadGoogleFont } from "./utils/fonts";

export function Page() {
  const [showSettings, setShowSettings] = createSignal(false);

  const defaultFontSize = 24;
  const defaultFontWeight = 400;
  const defaultWindowColor = "#ffffff";
  const defaultBackgroundColor = "#000000";
  const defaultTextColor = "#ffffff";

  const [windowColor, setWindowColor] = createSignal("#ffffff");
  const [backgroundColor, setBackgroundColor] = createSignal("#000000");
  const [textColor, setTextColor] = createSignal("#ffffff");
  const [fontSize, setFontSize] = createSignal(defaultFontSize);
  const [fontWeight, setFontWeight] = createSignal(defaultFontWeight);
  const [font, setFont] = createSignal(fonts[0]);

  createEffect(() => {
    loadGoogleFont(font(), [100, 200, 300, 400, 500, 600, 700, 800, 900]);
  });

  onMount(() => {
    ipcRenderer.on("vnOverlay:setSettings", (payload) => {
      const settings = payload.settings;
      setWindowColor(settings.windowColor);
      setBackgroundColor(settings.backgroundColor);
      setTextColor(settings.textColor);
      setFontSize(settings.fontSize);
      setFontWeight(settings.fontWeight);
      setFont(settings.font);
    });
  });

  return (
    <Box
      h="svh"
      w="full"
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
          これは日本語のサンプルテキストです。 This is sample text for learners.
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
