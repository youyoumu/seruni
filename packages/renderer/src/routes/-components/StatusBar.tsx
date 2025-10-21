import { BellDotIcon, BellIcon, ZapIcon, ZapOffIcon } from "lucide-solid";
import { Match, Switch } from "solid-js";
import { HStack } from "styled-system/jsx";
import { Icon } from "#/components/ui/icon";
import { Spinner } from "#/components/ui/spinner";
import { Text } from "#/components/ui/text";
import { type ClientStatus, store } from "#/lib/store";
import { NotificationHistory } from "./NotificationHistory";

export function StatusBar() {
  const [_, setStatusBarEl] = store.element.statusBar;

  function StatusIcon(props: { status: ClientStatus }) {
    return (
      <Switch fallback={null}>
        <Match when={props.status === "connected"}>
          <Icon
            size="xs"
            color="colorPalette.default"
            asChild={(iconProps) => <ZapIcon {...iconProps()} />}
          />
        </Match>

        <Match when={props.status === "disconnected"}>
          <Icon
            size="xs"
            color="fg.error"
            asChild={(iconProps) => <ZapOffIcon {...iconProps()} />}
          />
        </Match>

        <Match when={props.status === "connecting"}>
          <Icon
            size="xs"
            borderColor="colorPalette.subtle"
            asChild={(iconProps) => <Spinner {...iconProps()} />}
          />
        </Match>
      </Switch>
    );
  }
  return (
    <HStack
      ref={setStatusBarEl}
      bg="bg.emphasized"
      position="fixed"
      bottom="0"
      w="full"
      justifyContent="center"
    >
      <HStack w="full" maxW="8xl" justifyContent="end" p="1" gap="4" px="4">
        <HStack gap="1.5" cursor="default">
          <StatusIcon status={store.client.anki.status} />
          <Text size="xs">Anki</Text>
        </HStack>
        <HStack gap="1.5" cursor="default">
          <StatusIcon status={store.client.obs.status} />
          <Text size="xs">OBS</Text>
        </HStack>
        <HStack gap="1.5" cursor="default">
          <StatusIcon status={store.client.textractor.status} />
          <Text size="xs">Textractor</Text>
        </HStack>
        <NotificationHistory
          trigger={(props) => (
            <Icon
              cursor="pointer"
              size="sm"
              asChild={(iconProps) => (
                <Switch>
                  <Match
                    when={
                      store.notifications.filter(({ id }) => id).length === 0
                    }
                  >
                    <BellIcon {...iconProps()} />
                  </Match>
                  <Match
                    when={store.notifications.filter(({ id }) => id).length > 0}
                  >
                    <BellDotIcon {...iconProps()} />
                  </Match>
                </Switch>
              )}
              {...props}
            />
          )}
        />
      </HStack>
    </HStack>
  );
}
