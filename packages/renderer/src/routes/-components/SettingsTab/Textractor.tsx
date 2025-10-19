import { zConfig } from "@repo/preload/ipc";
import { UndoIcon } from "lucide-solid";
import { createEffect, createSignal, onMount } from "solid-js";
import { Grid, HStack, Stack } from "styled-system/jsx";
import { Heading } from "#/components/ui/heading";
import { IconButton } from "#/components/ui/icon-button";
import { NumberInput } from "#/components/ui/number-input";

const defaultTextractorConfig = zConfig.shape.textractor.parse({});

export function Textractor() {
  const [textractorWebSocketPort, setTextractorWebSocketPort] = createSignal(
    defaultTextractorConfig.textractorWebSocketPort,
  );

  let ready = false;
  createEffect(() => {
    const payload = {
      textractorWebSocketPort: textractorWebSocketPort(),
    };
    if (!ready) return;
    ipcRenderer.send("settings:setSettings", {
      textractor: payload,
    });
  });

  onMount(async () => {
    const settings = (await ipcRenderer.invoke("settings:getConfig"))
      .textractor;
    setTextractorWebSocketPort(settings.textractorWebSocketPort);

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
          Textractor
        </Heading>
      </Stack>
      <Grid gap="4" gridTemplateColumns="repeat(auto-fit, minmax(200px, 1fr))">
        <HStack alignItems="end">
          <NumberInput
            value={textractorWebSocketPort().toString()}
            clampValueOnBlur
            onValueChange={(e) => {
              setTextractorWebSocketPort(e.valueAsNumber);
            }}
            min={1023}
            max={65535}
            step={1}
          >
            Textractor WebSocket Port
          </NumberInput>
          <IconButton
            variant={
              textractorWebSocketPort() ===
              defaultTextractorConfig.textractorWebSocketPort
                ? "subtle"
                : "solid"
            }
            onClick={() => {
              setTextractorWebSocketPort(
                defaultTextractorConfig.textractorWebSocketPort,
              );
            }}
          >
            <UndoIcon />
          </IconButton>
        </HStack>
      </Grid>
    </Stack>
  );
}
