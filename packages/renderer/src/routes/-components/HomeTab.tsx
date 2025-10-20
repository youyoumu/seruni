import {
  ImageOffIcon,
  SquirrelIcon,
  TurtleIcon,
  ZapIcon,
  ZapOffIcon,
} from "lucide-solid";
import {
  createEffect,
  createSignal,
  type JSX,
  Match,
  onCleanup,
  onMount,
  Switch,
} from "solid-js";
import { css } from "styled-system/css";
import { Grid, HStack, Stack } from "styled-system/jsx";
import { Flip } from "#/components/Flip";
import { Alert } from "#/components/ui/alert";
import { Button } from "#/components/ui/button";
import { Heading } from "#/components/ui/heading";
import { Spinner } from "#/components/ui/spinner";
import { Icon } from "#/components/ui/styled/icon";
import { Text } from "#/components/ui/text";
import { type ClientStatus, setStore, store } from "#/lib/store";
import { appToaster } from "./AppToaster";

function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function HomeTab() {
  const [sourceScreenshot, setSourceScreenshot] = createSignal<string | null>(
    null,
  );
  onMount(() => {
    const id = setInterval(() => {
      ipcRenderer.invoke("general:getClientStatus").then((status) => {
        setStore("client", "anki", "status", status.anki);
        setStore("client", "obs", "status", status.obs);
        setStore("client", "textractor", "status", status.textractor);
      });
    }, 1000);

    const id2 = setInterval(() => {
      ipcRenderer.invoke("mining:getSourceScreenshot").then(({ image }) => {
        setSourceScreenshot(image);
      });
    }, 8000);

    onCleanup(() => {
      clearInterval(id);
      clearInterval(id2);
    });
  });

  createEffect(() => {});

  function StatusIcon(props: { status: ClientStatus }) {
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
          <StatusIcon status={store.client.anki.status} />
          <Alert.Content>
            <Alert.Title>Anki</Alert.Title>
            <Alert.Description>
              Status: {capitalize(store.client.anki.status)}
            </Alert.Description>
          </Alert.Content>
        </Alert.Root>

        <Alert.Root>
          <StatusIcon status={store.client.obs.status} />
          <Alert.Content>
            <Alert.Title>OBS</Alert.Title>
            <Alert.Description>
              Status: {capitalize(store.client.obs.status)}
            </Alert.Description>
          </Alert.Content>
        </Alert.Root>

        <Alert.Root>
          <StatusIcon status={store.client.textractor.status} />
          <Alert.Content>
            <Alert.Title>Textractor</Alert.Title>
            <Alert.Description>
              Status: {capitalize(store.client.textractor.status)}
            </Alert.Description>
          </Alert.Content>
        </Alert.Root>
      </Grid>
      <Stack>
        <HStack alignItems="end">
          <Stack flex="1">
            <Heading size="lg">OBS Preview</Heading>
            <Switch>
              <Match when={sourceScreenshot()}>
                <img
                  alt="OBS Preview"
                  src={sourceScreenshot() ?? ""}
                  class={css({
                    width: "md",
                    aspectRatio: "16 / 9",
                    objectFit: "contain",
                    borderColor: "border.default",
                    borderWidth: "thin",
                    rounded: "md",
                  })}
                />
              </Match>
              <Match when={!sourceScreenshot()}>
                <Stack
                  aspectRatio="16 / 9"
                  borderColor="border.default"
                  borderWidth="thin"
                  rounded="md"
                  justifyContent="center"
                  alignItems="center"
                >
                  <Flip>
                    <Icon
                      color="fg.muted"
                      width="32"
                      height="32"
                      strokeWidth="1"
                      asChild={(iconProps) => <SquirrelIcon {...iconProps()} />}
                    />
                  </Flip>
                  <Text color="fg.muted">Can't connect to OBS</Text>
                </Stack>
              </Match>
            </Switch>
          </Stack>
          <Stack flex="1">
            <Heading size="lg">Tutel</Heading>
            <Stack
              aspectRatio="16 / 9"
              borderColor="border.default"
              borderWidth="thin"
              rounded="md"
              justifyContent="center"
              alignItems="center"
            >
              <Flip>
                <Icon
                  color="fg.muted"
                  width="32"
                  height="32"
                  strokeWidth="1"
                  asChild={(iconProps) => <TurtleIcon {...iconProps()} />}
                />
              </Flip>
              <Text color="fg.muted">Tutel</Text>
            </Stack>
          </Stack>
        </HStack>
      </Stack>

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
