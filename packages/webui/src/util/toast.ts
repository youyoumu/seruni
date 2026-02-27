import { toast as heroToast } from "@heroui/react";
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
  options?: Omit<ToastItem, "id" | "title" | "timestamp">,
) => void;

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
    let successMsg: React.ReactNode | undefined;
    let errorMsg: React.ReactNode | undefined;

    heroToast.promise(promise, {
      loading: options.loading,
      success: (value) => {
        successMsg =
          typeof options.success === "function" ? options.success(value) : options.success;
        return successMsg;
      },
      error: (error) => {
        errorMsg = typeof options.error === "function" ? options.error(error) : options.error;
        return errorMsg;
      },
    });

    const promise_ = promise instanceof Promise ? promise : Promise.resolve(promise);
    promise_
      .then(() => {
        toastStore.trigger.addToast({
          id: uid(),
          title: successMsg ?? "Success",
          description: "",
          variant: "success",
          timestamp: Date.now(),
        });
      })
      .catch(() => {
        toastStore.trigger.addToast({
          id: uid(),
          title: errorMsg ?? "Error",
          description: "",
          variant: "danger",
          timestamp: Date.now(),
        });
      });
  };

  const toastFunction: ToastFunction = (title, options) => {
    const id = uid();
    const variant = options?.variant ?? "default";
    const description = options?.description;

    heroToast(title, { description, variant });

    const toastItem: ToastItem = {
      id,
      title,
      description,
      variant,
      timestamp: Date.now(),
    };
    toastStore.trigger.addToast(toastItem);
  };

  const toastInfo: ToastFunction = (title, options) =>
    toastFunction(title, { ...options, variant: "accent" });
  const toastSuccess: ToastFunction = (title, options) =>
    toastFunction(title, { ...options, variant: "success" });
  const toastWarning: ToastFunction = (title, options) =>
    toastFunction(title, { ...options, variant: "warning" });
  const toastDanger: ToastFunction = (title, options) =>
    toastFunction(title, { ...options, variant: "danger" });

  const toast: Toast = Object.assign(toastFunction, {
    promise: toastPromise,
    info: toastInfo,
    success: toastSuccess,
    warning: toastWarning,
    danger: toastDanger,
  });
  return toast;
}
