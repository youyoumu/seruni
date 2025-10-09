import { createEffect, createSignal, onMount } from "solid-js";
import { Grid, Stack } from "styled-system/jsx";
import { Heading } from "#/components/ui/heading";
import { NumberInput } from "#/components/ui/number-input";

export function OBS() {
  const [obsWebSocketPort, setObsWebSocketPort] = createSignal(7274);

  let ready = false;
  createEffect(() => {
    const payload = {
      obsWebSocketPort: obsWebSocketPort(),
    };
    if (!ready) return;
    ipcRenderer.send("settings:setSettings", {
      obs: payload,
    });
  });

  onMount(async () => {
    const settings = (await ipcRenderer.invoke("settings:getConfig")).obs;
    setObsWebSocketPort(settings.obsWebSocketPort);

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
          OBS
        </Heading>
      </Stack>
      <Grid gap="4" gridTemplateColumns="repeat(auto-fit, minmax(200px, 1fr))">
        <NumberInput
          value={obsWebSocketPort().toString()}
          clampValueOnBlur
          onValueChange={(e) => {
            setObsWebSocketPort(e.valueAsNumber);
          }}
          min={1023}
          max={65535}
          step={1}
        >
          OBS WebSocket Port
        </NumberInput>
      </Grid>
    </Stack>
  );
}
