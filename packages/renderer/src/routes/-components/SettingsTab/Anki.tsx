import { zConfig } from "@repo/preload/ipc";
import { UndoIcon } from "lucide-solid";
import { createEffect, createSignal, onMount } from "solid-js";
import { Grid, HStack, Stack } from "styled-system/jsx";
import { Field } from "#/components/ui/field";
import { Heading } from "#/components/ui/heading";
import { IconButton } from "#/components/ui/icon-button";
import { NumberInput } from "#/components/ui/number-input";

const defaultAnkiConfig = zConfig.shape.anki.parse({});

export function Anki() {
  const [pictureField, setPictureField] = createSignal(
    defaultAnkiConfig.pictureField,
  );
  const [sentenceAudioField, setSentenceAudioField] = createSignal(
    defaultAnkiConfig.sentenceAudioField,
  );
  const [ankiConnectPort, setAnkiConnectPort] = createSignal(
    defaultAnkiConfig.ankiConnectPort,
  );

  let ready = false;
  createEffect(() => {
    const payload = {
      pictureField: pictureField(),
      sentenceAudioField: sentenceAudioField(),
      ankiConnectPort: ankiConnectPort(),
    };
    if (!ready) return;
    ipcRenderer.send("settings:setSettings", {
      anki: payload,
    });
  });

  onMount(async () => {
    const settings = (await ipcRenderer.invoke("settings:getConfig")).anki;
    setPictureField(settings.pictureField);
    setSentenceAudioField(settings.sentenceAudioField);
    setAnkiConnectPort(settings.ankiConnectPort);

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
          <Field.Label>Picture Field</Field.Label>
          <Field.Input
            placeholder="Picture"
            value={pictureField()}
            onChange={(e) => {
              setPictureField(e.target.value);
            }}
          />
        </Field.Root>
        <Field.Root>
          <Field.Label>Sentence Audio Field</Field.Label>
          <Field.Input
            placeholder="Sentence Audio"
            value={sentenceAudioField()}
            onChange={(e) => {
              setSentenceAudioField(e.target.value);
            }}
          />
        </Field.Root>
        <HStack alignItems="end">
          <NumberInput
            value={ankiConnectPort().toString()}
            clampValueOnBlur
            onValueChange={(e) => {
              setAnkiConnectPort(e.valueAsNumber);
            }}
            min={1023}
            max={65535}
            step={1}
          >
            AnkiConnect Port
          </NumberInput>
          <IconButton
            onClick={() => {
              setAnkiConnectPort(defaultAnkiConfig.ankiConnectPort);
            }}
          >
            <UndoIcon />
          </IconButton>
        </HStack>
      </Grid>
    </Stack>
  );
}
