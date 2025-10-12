import {
  CheckIcon,
  InfoIcon,
  OctagonXIcon,
  ShieldAlertIcon,
} from "lucide-solid";
import { Match, Switch } from "solid-js";
import { css } from "styled-system/css";
import { Icon } from "#/components/ui/icon";
import { Spinner } from "#/components/ui/spinner";
import { Toast } from "#/components/ui/toast";

export type ToastType = "info" | "error" | "warning" | "success" | "loading";

export const appToaster = Toast.createToaster({
  placement: "bottom-end",
  overlap: true,
  gap: 16,
});

export function ToasterIcon(props: { type: ToastType }) {
  return (
    <Switch>
      <Match when={props.type === "info"}>
        <Icon asChild={(props) => <InfoIcon {...props()} />} />
      </Match>

      <Match when={props.type === "error"}>
        <Icon
          class={css({ color: "fg.error" })}
          asChild={(props) => <OctagonXIcon {...props()} />}
        />
      </Match>

      <Match when={props.type === "warning"}>
        <Icon
          class={css({ color: "yellow.dark.a10" })}
          asChild={(props) => <ShieldAlertIcon {...props()} />}
        />
      </Match>

      <Match when={props.type === "success"}>
        <Icon
          class={css({ color: "grass.dark.a10" })}
          asChild={(props) => <CheckIcon {...props()} />}
        />
      </Match>

      <Match when={props.type === "loading"}>
        <Icon
          asChild={(props) => <Spinner borderColor="fg.subtle" {...props()} />}
        />
      </Match>
    </Switch>
  );
}
