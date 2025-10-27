import {
  CheckIcon,
  InfoIcon,
  OctagonXIcon,
  ShieldAlertIcon,
} from "lucide-solid";
import { css } from "styled-system/css";
import { Icon } from "#/components/ui/icon";
import { Spinner } from "#/components/ui/spinner";
import { Toast } from "#/components/ui/toast";
import { setStore, store } from "#/lib/store";

export type AppToastType = "info" | "error" | "warning" | "success" | "loading";

class AppToaster {
  private toaster = Toast.createToaster({
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

  create(data: Parameters<typeof this.toaster.create>[0]) {
    const toastId = this.toaster.create(data);
    setStore("notifications", store.notifications.length, {
      id: toastId,
      title: data.title,
      description: data.description,
      type: data.type as AppToastType,
    });
    return toastId;
  }

  info(data: Parameters<typeof this.toaster.info>[0]) {
    return this.create({
      ...data,
      type: "info",
    });
  }

  loading(data: Parameters<typeof this.toaster.loading>[0]) {
    return this.create({
      ...data,
      type: "loading",
    });
  }

  error(data: Parameters<typeof this.toaster.error>[0]) {
    return this.create({
      ...data,
      type: "error",
    });
  }

  success(data: Parameters<typeof this.toaster.success>[0]) {
    return this.create({
      ...data,
      type: "success",
    });
  }

  warn(data: Parameters<typeof this.toaster.create>[0]) {
    return this.create({
      ...data,
      type: "warning",
    });
  }

  update(
    id: string | undefined,
    data: Parameters<typeof this.toaster.update>[1],
  ) {
    this.toaster.update(id ?? "", data);

    const notificationIndex = store.notifications.findIndex((n) => n.id === id);
    setStore("notifications", notificationIndex, {
      id,
      title: data.title,
      description: data.description,
      type: data.type,
    });
  }

  promise(
    promise: Parameters<typeof this.toaster.promise>[0],
    options: Parameters<typeof this.toaster.promise>[1],
  ) {
    const toast = this.toaster.promise(promise, options);
    setStore("notifications", store.notifications.length, {
      id: toast?.id,
      title: options.loading.title,
      description: options.loading.description,
      type: "loading",
    });

    const promise_ = typeof promise === "function" ? promise() : promise;
    const titleSuccess =
      typeof options.success === "object"
        ? options.success.title
        : typeof options.success === "function"
          ? options.success(undefined).title
          : undefined;
    const descriptionSuccess =
      typeof options.success === "object"
        ? options.success.description
        : typeof options.success === "function"
          ? options.success(undefined).description
          : undefined;
    const descriptionError =
      typeof options.error === "object"
        ? options.error.description
        : typeof options.error === "function"
          ? options.error(undefined).description
          : undefined;
    const titleError =
      typeof options.error === "object"
        ? options.error.title
        : typeof options.error === "function"
          ? options.error(undefined).title
          : undefined;

    promise_
      .then(() => {
        this.update(toast?.id, {
          id: toast?.id,
          title: titleSuccess,
          description: descriptionSuccess,
          type: "success",
        });
      })
      .catch(() => {
        this.update(toast?.id, {
          id: toast?.id,
          title: titleError,
          description: descriptionError,
          type: "error",
        });
      });

    return toast;
  }

  get original() {
    return this.toaster;
  }
}

export const appToaster = new AppToaster();

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
