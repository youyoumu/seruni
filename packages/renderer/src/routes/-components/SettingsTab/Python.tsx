import { ShieldAlertIcon } from "lucide-solid";
import { createSignal, onMount, Show } from "solid-js";
import { Grid, HStack, Stack } from "styled-system/jsx";
import { Alert } from "#/components/ui/alert";
import { Button } from "#/components/ui/button";
import { Field } from "#/components/ui/field";
import { Heading } from "#/components/ui/heading";
import { appToaster } from "../AppToaster";

export function Python() {
  const [isInstalled, setIsInstalled] = createSignal(false);
  const [isInstalling, setIsInstalling] = createSignal(false);
  const [pythonCommand, setPythonCommand] = createSignal("--version");

  onMount(async () => {
    const isPythonInstalled = await ipcRenderer.invoke(
      "settings:inPythonInstalled",
    );
    setIsInstalled(isPythonInstalled);
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
          Python
        </Heading>
      </Stack>
      <Show when={!isInstalled()}>
        <Alert.Root>
          <Alert.Icon
            color="yellow.dark.a10"
            asChild={(props) => {
              return <ShieldAlertIcon {...props()} />;
            }}
          ></Alert.Icon>
          <Alert.Title>Python is not installed</Alert.Title>
        </Alert.Root>
      </Show>
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
              disabled={!isInstalled() || isInstalling()}
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
          loading={isInstalling()}
          onClick={() => {
            setIsInstalling(true);
            appToaster.promise(
              ipcRenderer
                .invoke("settings:installPython")
                .then((success) => {
                  if (success) {
                    ipcRenderer
                      .invoke("settings:inPythonInstalled")
                      .then((isInstalled) => {
                        setIsInstalled(isInstalled);
                      });
                  } else {
                    throw new Error("Failed to reinstall Python");
                  }
                })
                .finally(() => {
                  setIsInstalling(false);
                }),
              {
                loading: {
                  title: isInstalled()
                    ? "Reinstalling Python..."
                    : "Installing Python...",
                },
                error: {
                  title: "Failed to install Python",
                },
                success: {
                  title: isInstalled()
                    ? "Python has been reinstalled"
                    : "Python has been installed",
                  duration: 5,
                },
              },
            );
          }}
        >
          {isInstalled() ? "Reinstall" : "Install"} Python
        </Button>
      </Grid>
    </Stack>
  );
}
