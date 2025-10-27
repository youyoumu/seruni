import { defaultConfig } from "@repo/preload/ipc";
import { debounce } from "es-toolkit";
import { UndoIcon } from "lucide-solid";
import { Grid, HStack, Stack } from "styled-system/jsx";
import { Field } from "#/components/ui/field";
import { Heading } from "#/components/ui/heading";
import { IconButton } from "#/components/ui/icon-button";
import { NumberInput } from "#/components/ui/number-input";
import { SettingsMutation, SettingsQuery } from "#/lib/query/settings";
import { appToaster } from "../AppToaster";

const defaultAnkiConfig = defaultConfig.anki;

export function Anki() {
  const configQuery = SettingsQuery.ConfigQuery.detail.use();
  const configMutation = SettingsMutation.ConfigMutation.setConfig();
  const [ankiConfig, setAnkiConfig] = createStore(
    structuredClone(defaultAnkiConfig),
  );

  const mutateConfigDebounce = debounce((payload: typeof ankiConfig) => {
    configMutation.mutate(
      { anki: payload },
      {
        onSuccess: () => {
          appToaster.success({ title: "Anki Settings Saved" });
        },
        onError: () => {
          appToaster.error({ title: "Failed to save Anki Settings" });
        },
      },
    );
  }, 1000);

  let ready = false;
  createEffect(() => {
    const newConfig = configQuery.data?.anki;
    if (!configQuery.isPlaceholderData && newConfig) {
      setAnkiConfig(newConfig);
      createEffect(() => {
        const payload = { ...ankiConfig };
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
          Anki
        </Heading>
      </Stack>
      <Grid gap="4" gridTemplateColumns="repeat(auto-fit, minmax(200px, 1fr))">
        <Field.Root>
          <Field.Label>Expression Field</Field.Label>
          <Field.Input
            placeholder="Expression"
            value={ankiConfig.expressionField}
            onChange={(e) => {
              setAnkiConfig("expressionField", e.target.value);
            }}
          />
        </Field.Root>
        <Field.Root>
          <Field.Label>Sentence Field</Field.Label>
          <Field.Input
            placeholder="Sentence"
            value={ankiConfig.sentenceField}
            onChange={(e) => {
              setAnkiConfig("sentenceField", e.target.value);
            }}
          />
        </Field.Root>
        <Field.Root>
          <Field.Label>Picture Field</Field.Label>
          <Field.Input
            placeholder="Picture"
            value={ankiConfig.pictureField}
            onChange={(e) => {
              setAnkiConfig("pictureField", e.target.value);
            }}
          />
        </Field.Root>
        <Field.Root>
          <Field.Label>Sentence Audio Field</Field.Label>
          <Field.Input
            placeholder="Sentence Audio"
            value={ankiConfig.sentenceAudioField}
            onChange={(e) => {
              setAnkiConfig("sentenceAudioField", e.target.value);
            }}
          />
        </Field.Root>
        <HStack alignItems="end">
          <NumberInput
            value={ankiConfig.ankiConnectPort.toString()}
            clampValueOnBlur
            onValueChange={(e) => {
              setAnkiConfig("ankiConnectPort", e.valueAsNumber);
            }}
            min={1023}
            max={65535}
            step={1}
          >
            AnkiConnect Port
          </NumberInput>
          <IconButton
            variant={
              ankiConfig.ankiConnectPort === defaultAnkiConfig.ankiConnectPort
                ? "subtle"
                : "solid"
            }
            onClick={() => {
              setAnkiConfig(
                "ankiConnectPort",
                defaultAnkiConfig.ankiConnectPort,
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
