import { getOwner } from "solid-js";
import { Grid, Stack } from "styled-system/jsx";
import { Button } from "#/components/ui/button";
import { SettingsQuery } from "#/lib/query/settings";

export function DebugTab() {
  const { PythonQuery } = SettingsQuery;
  const isPythonInstalledQuery = PythonQuery.isInstalled.use();
  const isPythonInstalled = () => isPythonInstalledQuery.data === true;

  onMount(() => {});

  createEffect(() => {});

  const owner = getOwner();

  return (
    <Suspense>
      <Stack gap="4" maxW="8xl" mx="auto">
        <Grid
          gap="2"
          gridTemplateColumns="repeat(auto-fit, minmax(200px, 1fr))"
        >
          <Button
            onClick={() => {
              console.log(isPythonInstalled());
            }}
          >
            Test
          </Button>
        </Grid>
        <Stack></Stack>
      </Stack>
    </Suspense>
  );
}
