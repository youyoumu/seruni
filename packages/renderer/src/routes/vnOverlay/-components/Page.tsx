import "./Page.css";

import { FloatingPanel } from "@ark-ui/solid/floating-panel";
import { css } from "styled-system/css";
import { Box } from "styled-system/jsx";
import { Text } from "#/components/ui/text";
import { loadGoogleFont } from "./utils/fonts";

export function Page() {
  const [text, setText] = createSignal("おはよう、昨日はよく眠れた？");

  const [opacity, setOpacity] = createSignal(1);
  const [windowColor, setWindowColor] = createSignal("#ffffff");
  const [backgroundColor, setBackgroundColor] = createSignal("#000000");
  const [textColor, setTextColor] = createSignal("#ffffff");
  const [fontSize, setFontSize] = createSignal(24);
  const [fontWeight, setFontWeight] = createSignal(400);
  const [font, setFont] = createSignal("");
  const [ready, setReady] = createSignal(false);

  createEffect(() => {
    loadGoogleFont(font(), [100, 200, 300, 400, 500, 600, 700, 800, 900]);
  });

  onMount(async () => {
    const settings = (await ipcRenderer.invoke("settings:getConfig"))?.window
      ?.vn_overlay;
    setOpacity(settings.opacity);
    setWindowColor(settings.windowColor);
    setBackgroundColor(settings.backgroundColor);
    setTextColor(settings.textColor);
    setFontSize(settings.fontSize);
    setFontWeight(settings.fontWeight);
    setFont(settings.font);

    ipcRenderer.on("vnOverlay:setSettings", (payload) => {
      setOpacity(payload.opacity);
      setWindowColor(payload.windowColor);
      setBackgroundColor(payload.backgroundColor);
      setTextColor(payload.textColor);
      setFontSize(payload.fontSize);
      setFontWeight(payload.fontWeight);
      setFont(payload.font);
    });

    ipcRenderer.on("vnOverlay:sendText", (payload) => {
      setText(payload?.text);
    });

    setReady(true);
  });

  const [hover, setHover] = createSignal(false);

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
      style={{
        opacity: hover() ? 1 : opacity(),
      }}
      class="draggable"
      transition="opacity"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
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
