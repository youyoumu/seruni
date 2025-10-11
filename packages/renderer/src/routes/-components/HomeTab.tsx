import { ZapIcon, ZapOffIcon } from "lucide-solid";
import {
  type Accessor,
  createEffect,
  createSignal,
  onCleanup,
  onMount,
} from "solid-js";
import { Grid, HStack, Stack } from "styled-system/jsx";
import { Alert } from "#/components/ui/alert";
import { Button } from "#/components/ui/button";
import { Spinner } from "#/components/ui/spinner";
import { appToaster } from "./AppToaster";
import { Sidebar } from "./Sidebar";

function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

type Status = "connected" | "disconnected" | "connecting";

export function HomeTab() {
  const [ankiStatus, setAnkiStatus] = createSignal<Status>("disconnected");
  const [obsStatus, setObsStatus] = createSignal<Status>("disconnected");
  const [textractorStatus, setTextractorStatus] =
    createSignal<Status>("disconnected");

  onMount(() => {
    const id = setInterval(() => {
      ipcRenderer.invoke("general:getClientStatus").then((status) => {
        setAnkiStatus(status.anki);
        setObsStatus(status.obs);
        setTextractorStatus(status.textractor);
      });
    }, 1000);
    onCleanup(() => clearInterval(id));
  });

  createEffect(() => {
    // console.log("ankiStatus", ankiStatus());
  });

  function icon(signal: Accessor<Status>) {
    switch (signal()) {
      case "connected":
        return (
          <Alert.Icon
            color="colorPalette.default"
            asChild={(iconProps) => <ZapIcon {...iconProps()} />}
          />
        );
      case "disconnected":
        return (
          <Alert.Icon
            color="fg.error"
            asChild={(iconProps) => <ZapOffIcon {...iconProps()} />}
          />
        );
      case "connecting":
        return (
          <Alert.Icon
            borderColor="colorPalette.subtle"
            asChild={(iconProps) => <Spinner {...iconProps()} />}
          />
        );
    }
  }

  return (
    <Stack gap="4" maxW="8xl" mx="auto">
      <Grid gap="2" gridTemplateColumns="repeat(auto-fit, minmax(200px, 1fr))">
        <Alert.Root>
          {icon(ankiStatus)}
          <Alert.Content>
            <Alert.Title>Anki</Alert.Title>
            <Alert.Description>
              Status: {capitalize(ankiStatus())}
            </Alert.Description>
          </Alert.Content>
        </Alert.Root>

        <Alert.Root>
          {icon(obsStatus)}
          <Alert.Content>
            <Alert.Title>OBS</Alert.Title>
            <Alert.Description>
              Status: {capitalize(obsStatus())}
            </Alert.Description>
          </Alert.Content>
        </Alert.Root>

        <Alert.Root>
          {icon(textractorStatus)}
          <Alert.Content>
            <Alert.Title>Textractor</Alert.Title>
            <Alert.Description>
              Status: {capitalize(textractorStatus())}
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

        <Sidebar />
      </HStack>
    </Stack>
  );
}
