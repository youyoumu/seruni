import { zSession, zTextHistory } from "#/db/schema";
import { zConfig } from "#/schema";
import { createCentralBus, createSchema, push, request } from "#/ws-bus";
import { R } from "@praha/byethrow";
import { uid } from "uid";
import { z } from "zod/mini";
export { WSBusError } from "#/ws-bus";

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

const createApi = () => {
  return createCentralBus(
    createSchema({
      clientPush: {
        ping: push(),
        action: push(z.string()),
        refreshAfkTimer: push(),
      },
      serverPush: {
        toast: push(zToastPayload),
        toastPromise: push(zToastPromiseConfig),
        toastPromiseResolve: push(zToastPromiseConfig),
        toastPromiseReject: push(zToastPromiseConfig),
        textHistory: push(zTextHistory),
        activeSession: push(z.nullable(zSession)),
        isListeningTextHooker: push(z.boolean()),
        isTextHookerAutoResume: push(z.boolean()),
        textHookerConnected: push(z.boolean()),
        ankiConnectConnected: push(z.boolean()),
        obsConnected: push(z.boolean()),
      },
      clientRequest: {
        textHistoryBySessionId: request(z.number(), z.array(zTextHistory)),
        deleteTextHistory: request(z.number(), z.nullable(zTextHistory)),
        completedTextHistory: request(z.undefined(), z.record(z.number(), z.number())),
        markTextHistoryAsCompleted: request(z.number(), z.nullable(zTextHistory)),
        session: request(z.number(), z.nullable(zSession)),
        sessions: request(z.undefined(), z.array(zSession)),
        createSession: request(z.string(), zSession),
        deleteSession: request(z.number(), z.nullable(zSession)),
        updateSession: request(z.partial(zSession), z.nullable(zSession)),
        setActiveSession: request(z.number(), z.nullable(zSession)),
        getActiveSession: request(z.undefined(), z.nullable(zSession)),
        isListeningTextHooker: request(z.undefined(), z.boolean()),
        setIsListeningTextHooker: request(z.boolean(), z.boolean()),
        isTextHookerAutoResume: request(z.undefined(), z.boolean()),
        setIsTextHookerAutoResume: request(z.boolean(), z.boolean()),
        textHookerConnected: request(z.undefined(), z.boolean()),
        ankiConnectConnected: request(z.undefined(), z.boolean()),
        obsConnected: request(z.undefined(), z.boolean()),
        config: request(z.undefined(), zConfig),
        setConfig: request(zConfig, z.nullable(zConfig)),
        checkHealth: request(z.undefined(), z.undefined()),
      },
      serverRequest: {
        userAgent: request(z.undefined(), z.string()),
      },
    }),
  );
};

export type ClientApi = ReturnType<typeof createApi>["client"]["api"];
export function createClientApi() {
  const api = createApi();
  return api.client;
}

export type ServerApi = ReturnType<typeof createApi>["server"]["api"] & {
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
  const api = createApi();
  const push = api.server.api.push;

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
    ...api.server,
    api: {
      ...api.server.api,
      toastPromise,
    },
  };
}
