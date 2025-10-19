import { zConfig } from "@repo/preload/ipc";
import { UndoIcon } from "lucide-solid";
import { createEffect, onMount } from "solid-js";
import { createStore } from "solid-js/store";
import { Grid, HStack, Stack } from "styled-system/jsx";
import { Field } from "#/components/ui/field";
import { Heading } from "#/components/ui/heading";
import { IconButton } from "#/components/ui/icon-button";
import { NumberInput } from "#/components/ui/number-input";

const defaultAnkiConfig = zConfig.shape.anki.parse({});

export function Anki() {
  const [ankiConfig, setAnkiConfig] = createStore({ ...defaultAnkiConfig });

  let ready = false;
  createEffect(() => {
    const payload = { ...ankiConfig };
    if (!ready) return;
    ipcRenderer.send("settings:setSettings", {
      anki: payload,
    });
  });

  onMount(async () => {
    const settings = (await ipcRenderer.invoke("settings:getConfig")).anki;
    setAnkiConfig(settings);

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
            variant={ankiConfig.ankiConnectPort === defaultAnkiConfig.ankiConnectPort ? "subtle" : "solid"}
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
