import { ZapIcon, ZapOffIcon } from "lucide-solid";
import { createEffect, Match, onCleanup, onMount, Switch } from "solid-js";
import { Grid, HStack, Stack } from "styled-system/jsx";
import { Alert } from "#/components/ui/alert";
import { Button } from "#/components/ui/button";
import { Spinner } from "#/components/ui/spinner";
import { type ClientStatus, setStore, store } from "#/lib/store";
import { appToaster } from "./AppToaster";

function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function HomeTab() {
  onMount(() => {
    const id = setInterval(() => {
      ipcRenderer.invoke("general:getClientStatus").then((status) => {
        setStore("client", "anki", "status", status.anki);
        setStore("client", "obs", "status", status.obs);
        setStore("client", "textractor", "status", status.textractor);
      });
    }, 1000);
    onCleanup(() => clearInterval(id));
  });

  createEffect(() => {});

  function Icon(props: { status: ClientStatus }) {
    return (
      <Switch fallback={null}>
        <Match when={props.status === "connected"}>
          <Alert.Icon
            color="colorPalette.default"
            asChild={(iconProps) => <ZapIcon {...iconProps()} />}
          />
        </Match>

        <Match when={props.status === "disconnected"}>
          <Alert.Icon
            color="fg.error"
            asChild={(iconProps) => <ZapOffIcon {...iconProps()} />}
          />
        </Match>

        <Match when={props.status === "connecting"}>
          <Alert.Icon
            borderColor="colorPalette.subtle"
            asChild={(iconProps) => <Spinner {...iconProps()} />}
          />
        </Match>
      </Switch>
    );
  }

  return (
    <Stack gap="4" maxW="8xl" mx="auto">
      <Grid gap="2" gridTemplateColumns="repeat(auto-fit, minmax(200px, 1fr))">
        <Alert.Root>
          <Icon status={store.client.anki.status} />
          <Alert.Content>
            <Alert.Title>Anki</Alert.Title>
            <Alert.Description>
              Status: {capitalize(store.client.anki.status)}
            </Alert.Description>
          </Alert.Content>
        </Alert.Root>

        <Alert.Root>
          <Icon status={store.client.obs.status} />
          <Alert.Content>
            <Alert.Title>OBS</Alert.Title>
            <Alert.Description>
              Status: {capitalize(store.client.obs.status)}
            </Alert.Description>
          </Alert.Content>
        </Alert.Root>

        <Alert.Root>
          <Icon status={store.client.obs.status} />
          <Alert.Content>
            <Alert.Title>Textractor</Alert.Title>
            <Alert.Description>
              Status: {capitalize(store.client.obs.status)}
            </Alert.Description>
          </Alert.Content>
        </Alert.Root>
      </Grid>

      <HStack>
        <Button
          onClick={() => {
            ipcRenderer.send("vnOverlay:open");
          }}
        >
          Open VN Overlay
        </Button>

        <Button
          onClick={() => {
            // appToaster.create({
            //   title: "Info",
            //   description: "This is an info toast.",
            //   action: {
            //     label: "Action",
            //     onClick: () => {
            //       console.log("clicked");
            //     },
            //   },
            //   type: "loading",
            //   // duration: Infinity,
            // });
            appToaster.promise(
              new Promise((resolve, reject) => setTimeout(resolve, 1000)),
              {
                loading: {
                  title: "Loading",
                  description: "This is a loading toast.",
                },
                success: {
                  title: "Success",
                  description: "This is a success toast.",
                },
                error: {
                  title: "Error",
                  description: "This is an error toast.",
                },
              },
            );
          }}
        >
          Toast
        </Button>
      </HStack>
    </Stack>
  );
}
