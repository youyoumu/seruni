import { defaultConfig } from "@repo/preload/ipc";
import { debounce } from "es-toolkit";
import { UndoIcon } from "lucide-solid";
import { Grid, HStack, Stack } from "styled-system/jsx";
import { Heading } from "#/components/ui/heading";
import { IconButton } from "#/components/ui/icon-button";
import { NumberInput } from "#/components/ui/number-input";
import { SettingsMutation, SettingsQuery } from "#/lib/query/querySettings";
import { appToaster } from "../AppToaster";

const defaultObsConfig = defaultConfig.obs;

export function OBS() {
  const configQuery = SettingsQuery.ConfigQuery.detail.use();
  const configMutation = SettingsMutation.ConfigMutation.setConfig();
  const [obsConfig, setObsConfig] = createStore(
    structuredClone(defaultObsConfig),
  );

  const mutateConfigDebounce = debounce((payload: typeof obsConfig) => {
    configMutation.mutate(
      { obs: payload },
      {
        onSuccess: () => {
          appToaster.success({ title: "OBS Settings Saved" });
        },
        onError: () => {
          appToaster.error({ title: "Failed to save OBS Settings" });
        },
      },
    );
  }, 1000);

  let ready = false;
  createEffect(() => {
    const newConfig = configQuery.data?.obs;
    if (!configQuery.isPlaceholderData && newConfig) {
      setObsConfig(newConfig);
      createEffect(() => {
        const payload = { ...obsConfig };
        if (!ready) {
          ready = true;
          return;
        }
        mutateConfigDebounce(payload);
      });
    }
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
            value={obsConfig.obsWebSocketPort.toString()}
            clampValueOnBlur
            onValueChange={(e) => {
              setObsConfig("obsWebSocketPort", e.valueAsNumber);
            }}
            min={1023}
            max={65535}
            step={1}
          >
            OBS WebSocket Port
          </NumberInput>
          <IconButton
            variant={
              obsConfig.obsWebSocketPort === defaultObsConfig.obsWebSocketPort
                ? "subtle"
                : "solid"
            }
            onClick={() => {
              setObsConfig(
                "obsWebSocketPort",
                defaultObsConfig.obsWebSocketPort,
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
