import { ShieldAlertIcon } from "lucide-solid";
import { createSignal, onMount, Show } from "solid-js";
import { Grid, Stack } from "styled-system/jsx";
import { Alert } from "#/components/ui/alert";
import { Button } from "#/components/ui/button";
import { Heading } from "#/components/ui/heading";
import { appToaster } from "../AppToaster";

export function Yomitan() {
  const [isInstalled, setIsInstalled] = createSignal(false);
  const [isInstalling, setIsInstalling] = createSignal(false);
  onMount(async () => {
    const isInstalled = await ipcRenderer.invoke("settings:isYomitanInstalled");
    return setIsInstalled(isInstalled);
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
          Yomitan
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
          <Alert.Title>Yomitan is not installed</Alert.Title>
        </Alert.Root>
      </Show>

      <Grid gap="4" gridTemplateColumns="repeat(auto-fit, minmax(200px, 1fr))">
        <Button
          disabled={!isInstalled() || isInstalling()}
          onClick={() => {
            ipcRenderer.send("yomitan:open");
          }}
        >
          Open Yomitan Settings
        </Button>
        <Button
          loading={isInstalling()}
          onClick={() => {
            setIsInstalling(true);
            appToaster.promise(
              ipcRenderer
                .invoke("yomitan:reinstall")
                .then((success) => {
                  if (success) {
                    ipcRenderer
                      .invoke("settings:isYomitanInstalled")
                      .then((isInstalled) => {
                        setIsInstalled(isInstalled);
                      });
                    setIsInstalled(true);
                  } else {
                    throw new Error("Failed to reinstall Yomitan");
                  }
                })
                .finally(() => {
                  setIsInstalling(false);
                }),
              {
                loading: {
                  title: isInstalled()
                    ? "Updating Yomitan..."
                    : "Installing Yomitan...",
                },
                error: {
                  title: "Failed to install Yomitan",
                },
                success: {
                  title: isInstalled()
                    ? "Yomitan has been updated"
                    : "Yomitan has been installed",
                  description: "Reload to apply changes",
                  duration: Infinity,
                  action: {
                    label: "Reload",
                    onClick: () => {
                      ipcRenderer.send("general:reloadMainWindow");
                    },
                  },
                },
              },
            );
          }}
        >
          {isInstalled() ? "Update" : "Install"} Yomitan
        </Button>
      </Grid>
    </Stack>
  );
}
