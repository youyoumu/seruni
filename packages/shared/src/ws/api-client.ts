import { zSession, zTextHistory } from "#/db/schema";
import { KrissanClient } from "#/krissan/client";
import { defineKrissanSchema } from "#/krissan/client";
import { KrissanServer, type ServerPushTargetPicker } from "#/krissan/server";
import { zConfig } from "#/schema";
import { R } from "@praha/byethrow";
import { uid } from "uid";
import { z } from "zod/mini";

export const zToastVariant = z.enum(["default", "accent", "success", "warning", "danger"]);

export const zToastPayload = z.object({
  title: z.optional(z.string()),
  description: z.optional(z.string()),
  variant: z.optional(zToastVariant),
  action: z.optional(z.object({ id: z.string(), text: z.string() })),
});

export const zToastPayloadFix = z.object({
  title: z.optional(z.string()),
  description: z.optional(z.string()),
  action: z.optional(z.object({ id: z.string(), text: z.string() })),
});

export const zToastPromiseConfig = z.object({
  title: z.optional(z.string()),
  description: z.optional(z.string()),
  action: z.optional(z.object({ id: z.string(), text: z.string() })),
  id: z.string(),
});

export type ToastVariant = z.infer<typeof zToastVariant>;
export type ToastPayload = z.infer<typeof zToastPayload>;
export type ToastPayloadFix = z.infer<typeof zToastPayloadFix>;
export type ToastPromiseConfig = z.infer<typeof zToastPromiseConfig>;
export type ToastPromiseResolvePayload = ToastPromiseConfig;
export type ToastPromiseRejectPayload = ToastPromiseConfig;

const schema = defineKrissanSchema({
  clientPushes: {
    "system/ping": z.undefined(),
    "action/dispatch": z.string(),
    "timer/afk/refresh": z.undefined(),
  },
  serverPushes: {
    "toast/show": zToastPayload,
    "toast/promise/start": zToastPromiseConfig,
    "toast/promise/resolve": zToastPromiseConfig,
    "toast/promise/reject": zToastPromiseConfig,
    "text-history/create": zTextHistory,
    "session/active/set": z.nullable(zSession),
    "text-hooker/listening/set": z.boolean(),
    "text-hooker/auto-resume/set": z.boolean(),
    "text-hooker/connected/set": z.boolean(),
    "anki-connect/connected/set": z.boolean(),
    "obs/connected/set": z.boolean(),
  },
  clientRequests: {
    "text-history/by-session/get": [z.number(), z.array(zTextHistory)],
    "text-history/delete": [z.number(), z.nullable(zTextHistory)],
    "text-history/completed/get": [z.undefined(), z.record(z.number(), z.number())],
    "text-history/completed/set": [z.number(), zTextHistory, z.literal("INVALID_ID")],
    "session/get": [z.number(), zSession, z.literal("INVALID_ID")],
    "session/list": [z.undefined(), z.array(zSession)],
    "session/create": [z.string(), zSession],
    "session/delete": [z.number(), zSession, z.literal("INVALID_ID")],
    "session/update": [z.partial(zSession), zSession, z.literal("INVALID_ID")],
    "session/active/set": [z.number(), zSession, z.literal("INVALID_ID")],
    "session/active/get": [z.undefined(), z.nullable(zSession)],
    "text-hooker/listening/get": [z.undefined(), z.boolean()],
    "text-hooker/listening/set": [z.boolean(), z.boolean()],
    "text-hooker/auto-resume/get": [z.undefined(), z.boolean()],
    "text-hooker/auto-resume/set": [z.boolean(), z.boolean()],
    "text-hooker/connected/get": [z.undefined(), z.boolean()],
    "anki-connect/connected/get": [z.undefined(), z.boolean()],
    "obs/connected/get": [z.undefined(), z.boolean()],
    "config/get": [z.undefined(), zConfig],
    "config/set": [zConfig, zConfig, z.literal("INVALID_CONFIG")],
    "health/check": [z.undefined(), z.null()],
  },
  serverRequests: {
    "user-agent/get": [z.undefined(), z.string()],
  },
});

export type ClientApi = ReturnType<typeof createClientApi>["api"];
export function createClientApi() {
  return new KrissanClient(schema);
}

export type ServerApi = ReturnType<typeof createServerApi>["api"] & {
  toastPromise: ToastPromiseFn;
};

type ToastPromiseFn = <TData, TError>(
  promise: () => Promise<R.Result<TData, TError>>,
  options: {
    loading: ToastPayloadFix;
    success: ToastPayloadFix | ((data: TData) => ToastPayloadFix);
    error: ToastPayloadFix | ((error: TError) => ToastPayloadFix);
    target?: ServerPushTargetPicker;
  },
) => Promise<R.Result<TData, TError>>;

export function createServerApi() {
  const socket = new KrissanServer(schema);
  const push = socket.api.push;

  const toastPromise: ToastPromiseFn = async (promise, options) => {
    const { loading, success, error, target } = options;
    const id = uid();
    push["toast/promise/start"]({ id, ...loading }, target);

    const data = await promise();
    if (R.isSuccess(data)) {
      const computedSuccess = typeof success === "function" ? success(data.value) : success;
      push["toast/promise/resolve"]({ id, ...computedSuccess }, target);
    }
    if (R.isFailure(data)) {
      const computedError = typeof error === "function" ? error(data.error) : error;
      push["toast/promise/reject"]({ id, ...computedError }, target);
    }
    return data;
  };

  return {
    onMessage: socket.onMessage.bind(socket),
    onOpen: socket.onOpen.bind(socket),
    onClose: socket.onClose.bind(socket),
    api: {
      ...socket.api,
      toastPromise,
    },
  };
}
