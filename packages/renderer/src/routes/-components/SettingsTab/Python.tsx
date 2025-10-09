import { createSignal } from "solid-js";
import { Grid, HStack, Stack } from "styled-system/jsx";
import { Button } from "#/components/ui/button";
import { Field } from "#/components/ui/field";
import { Heading } from "#/components/ui/heading";

export function Python() {
  const [pythonCommand, setPythonCommand] = createSignal("--version");

  return (
    <Stack gap="2" w="full">
      <Stack>
        <Heading
          size="2xl"
          borderBottomColor="border.default"
          borderBottomWidth="medium"
          pb="2"
        >
          Python
        </Heading>
      </Stack>
      <Grid
        gap="4"
        gridTemplateColumns="repeat(auto-fit, minmax(200px, 1fr))"
        alignItems="end"
      >
        <Field.Root>
          <Field.Label>Python Command</Field.Label>
          <HStack>
            <Field.Input
              placeholder="--version"
              value={pythonCommand()}
              onChange={(e) => {
                setPythonCommand(e.target.value);
              }}
            />
            <Button
              onClick={() => {
                const params = pythonCommand().split(" ");
                ipcRenderer.send("settings:runPython", [...params]);
              }}
            >
              Run
            </Button>
          </HStack>
        </Field.Root>
        <Button
          onClick={() => {
            ipcRenderer.send("settings:installPython");
          }}
        >
          Install Python
        </Button>
      </Grid>
    </Stack>
  );
}
