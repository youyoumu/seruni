import { createEffect, createSignal, onMount } from "solid-js";
import { Grid, Stack } from "styled-system/jsx";
import { Field } from "#/components/ui/field";
import { Heading } from "#/components/ui/heading";

export function Anki() {
  const [pictureField, setPictureField] = createSignal("");
  const [sentenceAudioField, setSentenceAudioField] = createSignal("");

  let ready = false;
  createEffect(() => {
    const payload = {
      pictureField: pictureField(),
      sentenceAudioField: sentenceAudioField(),
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

    ready = true;
  });

  return (
    <Stack gap="2" w="full">
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
      <Grid gap="2" gridTemplateColumns="repeat(auto-fit, minmax(200px, 1fr))">
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
      </Grid>
    </Stack>
  );
}
