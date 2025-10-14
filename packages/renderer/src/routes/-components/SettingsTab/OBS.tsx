import { zConfig } from "@repo/preload/ipc";
import { UndoIcon } from "lucide-solid";
import { createEffect, createSignal, onMount } from "solid-js";
import { Grid, HStack, Stack } from "styled-system/jsx";
import { Heading } from "#/components/ui/heading";
import { IconButton } from "#/components/ui/icon-button";
import { NumberInput } from "#/components/ui/number-input";

const defaultObsConfig = zConfig.shape.obs.parse({});

export function OBS() {
  const [obsWebSocketPort, setObsWebSocketPort] = createSignal(
    defaultObsConfig.obsWebSocketPort,
  );

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
        <HStack alignItems="end">
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
          <IconButton
            onClick={() => {
              setObsWebSocketPort(defaultObsConfig.obsWebSocketPort);
            }}
          >
            <UndoIcon />
          </IconButton>
        </HStack>
      </Grid>
    </Stack>
  );
}
