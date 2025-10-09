import { Grid, Stack } from "styled-system/jsx";
import { Button } from "#/components/ui/button";
import { Heading } from "#/components/ui/heading";

export function Yomitan() {
  return (
    <Stack gap="2" w="full">
      <Stack>
        <Heading
          size="2xl"
          borderBottomColor="border.default"
          borderBottomWidth="medium"
          pb="2"
        >
          Yomitan
        </Heading>
      </Stack>
      <Grid gap="2" gridTemplateColumns="repeat(auto-fit, minmax(200px, 1fr))">
        <Button
          onClick={() => {
            ipcRenderer.send("yomitan:open");
          }}
        >
          Open Yomitan Settings
        </Button>
        <Button
          onClick={() => {
            ipcRenderer.send("yomitan:reinstall");
          }}
        >
          Reinstall Yomitan
        </Button>
      </Grid>
    </Stack>
  );
}
