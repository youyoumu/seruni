import { defaultConfig } from "@repo/preload/ipc";
import { debounce } from "es-toolkit";
import { UndoIcon } from "lucide-solid";
import { Grid, HStack, Stack } from "styled-system/jsx";
import { Heading } from "#/components/ui/heading";
import { IconButton } from "#/components/ui/icon-button";
import { NumberInput } from "#/components/ui/number-input";
import { SettingsMutation, SettingsQuery } from "#/lib/query/querySettings";
import { appToaster } from "../AppToaster";

const defaultTextractorConfig = defaultConfig.textractor;

export function Textractor() {
  const configQuery = SettingsQuery.ConfigQuery.detail.use();
  const configMutation = SettingsMutation.ConfigMutation.setConfig();
  const [textractorConfig, setTextractorConfig] = createStore(
    structuredClone(defaultTextractorConfig),
  );

  const mutateConfigDebounce = debounce((payload: typeof textractorConfig) => {
    configMutation.mutate(
      { textractor: payload },
      {
        onSuccess: () => {
          appToaster.success({ title: "Textractor Settings Saved" });
        },
        onError: () => {
          appToaster.error({ title: "Failed to save Textractor Settings" });
        },
      },
    );
  }, 1000);

  let ready = false;
  createEffect(() => {
    const newConfig = configQuery.data?.textractor;
    if (!configQuery.isPlaceholderData && newConfig) {
      setTextractorConfig(newConfig);
      createEffect(() => {
        const payload = { ...textractorConfig };
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
          Textractor
        </Heading>
      </Stack>
      <Grid gap="4" gridTemplateColumns="repeat(auto-fit, minmax(200px, 1fr))">
        <HStack alignItems="end">
          <NumberInput
            value={textractorConfig.textractorWebSocketPort.toString()}
            clampValueOnBlur
            onValueChange={(e) => {
              setTextractorConfig("textractorWebSocketPort", e.valueAsNumber);
            }}
            min={1023}
            max={65535}
            step={1}
          >
            Textractor WebSocket Port
          </NumberInput>
          <IconButton
            variant={
              textractorConfig.textractorWebSocketPort ===
              defaultTextractorConfig.textractorWebSocketPort
                ? "subtle"
                : "solid"
            }
            onClick={() => {
              setTextractorConfig(
                "textractorWebSocketPort",
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
