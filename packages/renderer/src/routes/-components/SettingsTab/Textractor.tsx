import { createEffect, createSignal, onMount } from "solid-js";
import { Grid, Stack } from "styled-system/jsx";
import { Heading } from "#/components/ui/heading";
import { NumberInput } from "#/components/ui/number-input";

export function Textractor() {
  const [textractorWebSocketPort, setTextractorWebSocketPort] =
    createSignal(6677);

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
      </Grid>
    </Stack>
  );
}
