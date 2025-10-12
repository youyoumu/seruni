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
import { setStore, store } from "#/lib/store";

export type AppToastType = "info" | "error" | "warning" | "success" | "loading";

export const appToaster = {
  create(data: Parameters<typeof appToaster_.create>[0]) {
    const toastId = appToaster_.create(data);
    setStore("notifications", store.notifications.length, {
      id: toastId,
      title: data.title,
      description: data.description,
      type: data.type as AppToastType,
    });
    return toastId;
  },
  promise(
    promise: Parameters<typeof appToaster_.promise>[0],
    options: Parameters<typeof appToaster_.promise>[1],
  ) {
    const toast = appToaster_.promise(promise, options);

    setStore("notifications", store.notifications.length, {
      id: toast?.id,
      title: options.loading.title,
      description: options.loading.description,
      type: "loading",
    });

    const notificationIndex = store.notifications.findIndex(
      (notification) => notification.id === toast?.id,
    );

    const promise_ = typeof promise === "function" ? promise() : promise;

    promise_
      .then(() => {
        const title =
          typeof options.success === "object"
            ? options.success.title
            : typeof options.success === "function"
              ? options.success(undefined).title
              : undefined;

        const description =
          typeof options.success === "object"
            ? options.success.description
            : typeof options.success === "function"
              ? options.success(undefined).description
              : undefined;

        setStore("notifications", notificationIndex, {
          id: toast?.id,
          title,
          description,
          type: "success",
        });
      })
      .catch(() => {
        const title =
          typeof options.error === "object"
            ? options.error.title
            : typeof options.error === "function"
              ? options.error(undefined).title
              : undefined;

        const description =
          typeof options.error === "object"
            ? options.error.description
            : typeof options.error === "function"
              ? options.error(undefined).description
              : undefined;

        setStore("notifications", notificationIndex, {
          id: toast?.id,
          title,
          description,
          type: "error",
        });
      });

    return toast;
  },
};

export const appToaster_ = Toast.createToaster({
  placement: "bottom-end",
  overlap: true,
  gap: 16,
  offsets: {
    bottom: "40px",
    left: "0px",
    top: "0px",
    right: "10px",
  },
});

export function ToasterIcon(props: { type: AppToastType }) {
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
