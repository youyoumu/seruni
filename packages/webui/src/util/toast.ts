import { toast as heroToast, type ButtonRootProps } from "@heroui/react";
import { createStore } from "@xstate/store";
import { uid } from "uid";

type ToastItem = {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  variant?: "default" | "accent" | "success" | "warning" | "danger";
  timestamp: number;
};

export function createToastStore() {
  return createStore({
    context: {
      history: [] as ToastItem[],
    },
    on: {
      addToast: (context, payload: ToastItem) => ({
        ...context,
        history: [payload, ...context.history].slice(0, 50),
      }),
      removeToast: (context, payload: { id: string }) => ({
        ...context,
        history: context.history.filter((t) => t.id !== payload.id),
      }),
      clearHistory: (context) => ({
        ...context,
        history: [],
      }),
    },
  });
}

type ToastStore = ReturnType<typeof createToastStore>;

type ToastFunction = (
  title: React.ReactNode,
  options?: Omit<ToastItem, "id" | "title" | "timestamp"> & {
    isLoading?: boolean;
    timeout?: number;
    actionProps?: ButtonRootProps;
  },
) => string;

type ToastPromiseFunction = (
  promise: (() => Promise<unknown>) | Promise<unknown>,
  options: {
    loading: React.ReactNode;
    success: React.ReactNode | ((data: unknown) => React.ReactNode);
    error: React.ReactNode | ((error: unknown) => React.ReactNode);
  },
) => void;

interface Toast extends ToastFunction {
  promise: ToastPromiseFunction;
  info: ToastFunction;
  success: ToastFunction;
  warning: ToastFunction;
  danger: ToastFunction;
  close: (id: string) => void;
}

export function createToast(toastStore: ToastStore): Toast {
  const toastPromise = (
    promise: (() => Promise<unknown>) | Promise<unknown>,
    options: {
      loading: React.ReactNode;
      success: React.ReactNode | ((data: unknown) => React.ReactNode);
      error: React.ReactNode | ((error: unknown) => React.ReactNode);
    },
  ) => {
    let successTitle: React.ReactNode | undefined;
    let errorTitle: React.ReactNode | undefined;

    heroToast.promise(promise, {
      loading: options.loading,
      success: (value) => {
        successTitle =
          typeof options.success === "function" ? options.success(value) : options.success;
        return successTitle;
      },
      error: (error) => {
        errorTitle = typeof options.error === "function" ? options.error(error) : options.error;
        return errorTitle;
      },
    });

    const promise_ = promise instanceof Promise ? promise : Promise.resolve(promise);
    promise_
      .then(() => {
        toastStore.trigger.addToast({
          id: uid(),
          title: successTitle,
          variant: "success",
          timestamp: Date.now(),
        });
      })
      .catch(() => {
        toastStore.trigger.addToast({
          id: uid(),
          title: errorTitle,
          variant: "danger",
          timestamp: Date.now(),
        });
      });
  };

  const toastFunction: ToastFunction = (title, options) => {
    const id = uid();
    const toastId = heroToast(title, options);
    const toastItem: ToastItem = {
      id,
      title,
      description: options?.description,
      variant: options?.variant ?? "default",
      timestamp: Date.now(),
    };
    if (!options?.isLoading) toastStore.trigger.addToast(toastItem);
    return toastId;
  };

  const toastInfo: ToastFunction = (title, options) =>
    toastFunction(title, { ...options, variant: "accent" });
  const toastSuccess: ToastFunction = (title, options) =>
    toastFunction(title, { ...options, variant: "success" });
  const toastWarning: ToastFunction = (title, options) =>
    toastFunction(title, { ...options, variant: "warning" });
  const toastDanger: ToastFunction = (title, options) =>
    toastFunction(title, { ...options, variant: "danger" });

  const close = heroToast.close;

  const toast: Toast = Object.assign(toastFunction, {
    promise: toastPromise,
    info: toastInfo,
    success: toastSuccess,
    warning: toastWarning,
    danger: toastDanger,
    close,
  });
  return toast;
}
