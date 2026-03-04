import { zSession, zTextHistory } from "#/db/schema";
import { zConfig } from "#/schema";
import { defineSocketSchema, createClientSocket, createServerSocket } from "#/sock.et";
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

const schema = defineSocketSchema({
  clientPush: {
    ping: z.undefined(),
    action: z.string(),
    refreshAfkTimer: z.undefined(),
  },
  serverPush: {
    toast: zToastPayload,
    toastPromise: zToastPromiseConfig,
    toastPromiseResolve: zToastPromiseConfig,
    toastPromiseReject: zToastPromiseConfig,
    textHistory: zTextHistory,
    activeSession: z.nullable(zSession),
    isListeningTextHooker: z.boolean(),
    isTextHookerAutoResume: z.boolean(),
    textHookerConnected: z.boolean(),
    ankiConnectConnected: z.boolean(),
    obsConnected: z.boolean(),
  },
  clientRequest: {
    textHistoryBySessionId: [z.number(), z.array(zTextHistory)],
    deleteTextHistory: [z.number(), z.nullable(zTextHistory)],
    completedTextHistory: [z.undefined(), z.record(z.number(), z.number())],
    markTextHistoryAsCompleted: [z.number(), z.nullable(zTextHistory)],
    session: [z.number(), z.nullable(zSession)],
    sessions: [z.undefined(), z.array(zSession)],
    createSession: [z.string(), zSession],
    deleteSession: [z.number(), z.nullable(zSession)],
    updateSession: [z.partial(zSession), z.nullable(zSession)],
    setActiveSession: [z.number(), z.nullable(zSession)],
    getActiveSession: [z.undefined(), z.nullable(zSession)],
    isListeningTextHooker: [z.undefined(), z.boolean()],
    setIsListeningTextHooker: [z.boolean(), z.boolean()],
    isTextHookerAutoResume: [z.undefined(), z.boolean()],
    setIsTextHookerAutoResume: [z.boolean(), z.boolean()],
    textHookerConnected: [z.undefined(), z.boolean()],
    ankiConnectConnected: [z.undefined(), z.boolean()],
    obsConnected: [z.undefined(), z.boolean()],
    config: [z.undefined(), zConfig],
    setConfig: [zConfig, z.nullable(zConfig)],
    checkHealth: [z.undefined(), z.undefined()],
  },
  serverRequest: {
    userAgent: [z.undefined(), z.string()],
  },
});

export type ClientApi = ReturnType<typeof createClientApi>["api"];
export function createClientApi() {
  return createClientSocket(schema);
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
  },
) => Promise<R.Result<TData, TError>>;

export function createServerApi() {
  const socket = createServerSocket(schema);
  const push = socket.api.push;

  const toastPromise: ToastPromiseFn = async (promise, options) => {
    const { loading, success, error } = options;
    const id = uid();
    push.toastPromise({ id, ...loading });

    const data = await promise();
    if (R.isSuccess(data)) {
      const computedSuccess = typeof success === "function" ? success(data.value) : success;
      push.toastPromiseResolve({ id, ...computedSuccess });
    }
    if (R.isFailure(data)) {
      const computedError = typeof error === "function" ? error(data.error) : error;
      push.toastPromiseReject({ id, ...computedError });
    }
    return data;
  };

  return {
    ...socket,
    api: {
      ...socket.api,
      toastPromise,
    },
  };
}
