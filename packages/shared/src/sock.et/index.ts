import { type StandardSchemaV1 } from "@standard-schema/spec";

type StandardSchema = StandardSchemaV1;
type Infer<T extends StandardSchema> = StandardSchemaV1.InferOutput<T>;
type Arg<T1, T2 = undefined> = undefined extends T1
  ? undefined extends T2
    ? [arg1?: T1, arg2?: T2]
    : [arg1: T1 | undefined, arg2: T2]
  : undefined extends T2
    ? [arg1: T1, arg2?: T2]
    : [arg1: T1, arg2: T2];

const uid = () => Math.random().toString(36).slice(2);

const SocketErr = {
  ConnectionClosed: "ConnectionClosed",
  RequestTimeout: "RequestTimeout",
};
class SocketError extends Error {
  static ConnectionClosed = SocketErr.ConnectionClosed;
  static RequestTimeout = SocketErr.RequestTimeout;
  constructor(public readonly type: (typeof SocketErr)[keyof typeof SocketErr]) {
    super();
    this.name = "SocketError";
  }
}
type SocketResponse<T = unknown> =
  | { type: "Success"; value: T }
  | { type: "Failure"; error: unknown };

interface SocketBody<T = unknown> {
  value?: T;
}
/**
 * Wire-level packet exchanged between client and server.
 * - `method`: packet intent
 * - `event`: schema key/event name
 * - `body`: validated payload container
 * - `headers`: protocol metadata (correlation/cookie/timestamp)
 */
interface SocketPacket {
  "sock.et": typeof SOCKET_MAGIC_NUMBER;
  method: "PUSH" | "REQUEST" | "RESPONSE" | "ERROR";
  event: string;
  body: SocketBody;
  headers?: SocketHeaders;
}
type SocketPacketPayload = Omit<SocketPacket, "sock.et">;
interface SocketHeaders {
  cid?: string;
  timestamp?: number;
  cookie?: Record<string, string>;
  "set-cookie"?: Record<string, string>;
}
interface SocketReqHandlerContext<TBody = unknown> {
  req: Readonly<{
    method: "REQUEST";
    event: string;
    body: TBody;
    headers: Readonly<SocketHeaders>;
  }>;
  res: {
    method: "RESPONSE" | "ERROR";
    event: string;
    header: SocketHeaders;
    body?: unknown;
  };
}
interface SocketPushHandlerContext<TBody = unknown> {
  push: Readonly<{
    method: "PUSH";
    event: string;
    body: TBody;
    headers: Readonly<SocketHeaders>;
  }>;
}
type SocketNext = () => Promise<void>;
type SocketPushHandler<TBody = unknown> = (
  c: SocketPushHandlerContext<TBody>,
) => void | Promise<void>;
type SocketReqMiddleware<TReq = unknown, TRes = unknown> = (
  c: SocketReqHandlerContext<TReq>,
  next: SocketNext,
) => TRes | void | Promise<TRes | void>;
type SocketRequestMatcher =
  | string
  | string[]
  | RegExp
  | ((c: SocketReqHandlerContext<unknown>) => boolean | Promise<boolean>);
interface WS {
  send: (data: string) => void;
  readyState: WebSocket["readyState"];
}
interface SocketContext {
  ws?: WS;
}

const SOCKET_MAGIC_NUMBER = 16777619;
const DEFAULT_TIMEOUT = 300000;

class SocketEvent extends Event {
  constructor(
    type: string,
    public body: SocketBody,
    public headers: SocketHeaders = {},
    public context: SocketContext = {},
  ) {
    super(type);
  }
}

class Bus extends EventTarget {
  /** Subscribe to a named event; returns an unsubscribe function. */
  on(
    event: string,
    handler: (packet: { body: SocketBody; headers: SocketHeaders; context: SocketContext }) => void,
  ) {
    const fn = (e: Event) =>
      e instanceof SocketEvent && handler({ body: e.body, headers: e.headers, context: e.context });
    this.addEventListener(event, fn);
    return () => this.removeEventListener(event, fn);
  }
}

type PushSchemas<T extends Record<string, StandardSchema>> = {
  [K in keyof T]: { push: Infer<T[K]> };
};
type ReqSchemas<T extends Record<string, [StandardSchema, StandardSchema]>> = {
  [K in keyof T]: { req: Infer<T[K][0]>; res: Infer<T[K][1]> };
};
interface SocketSchemas {
  clientPushes: Record<string, StandardSchema>;
  serverPushes: Record<string, StandardSchema>;
  clientRequests: Record<string, [StandardSchema, StandardSchema]>;
  serverRequests: Record<string, [StandardSchema, StandardSchema]>;
}

type RequestOption = { timeout?: number } | undefined;

function defineSocketSchema<T extends SocketSchemas>(schema: T) {
  return schema;
}

function createSocket<const Schema extends SocketSchemas>(
  schemas: Schema,
  options?: { clientTimeout?: number; serverTimeout?: number; uid?: () => string },
) {
  type CPush = PushSchemas<NonNullable<Schema["clientPushes"]>>;
  type SPush = PushSchemas<NonNullable<Schema["serverPushes"]>>;
  type CReq = ReqSchemas<NonNullable<Schema["clientRequests"]>>;
  type SReq = ReqSchemas<NonNullable<Schema["serverRequests"]>>;

  const clientWS: { ws: WS | undefined } = { ws: undefined };
  const clientCookie = { value: {} as Record<string, string> };
  const createUid = options?.uid ?? uid;
  const serverWS = { ws: new Set<WS>() };

  /**
   * Internal event buses by direction + packet kind:
   * - c*: events received/initiated by client side
   * - s*: events received/initiated by server side
   * - Push/Req/Res/Err: method lanes
   */
  const buses = {
    cPush: new Bus(),
    sPush: new Bus(),
    cReq: new Bus(),
    sReq: new Bus(),
    cRes: new Bus(),
    sRes: new Bus(),
    cErr: new Bus(),
    sErr: new Bus(),
  };

  const sanitizeCookie = (cookie: unknown): Record<string, string> | undefined => {
    if (!cookie || typeof cookie !== "object" || Array.isArray(cookie)) return undefined;
    const sanitized: Record<string, string> = {};
    Object.entries(cookie).forEach(([k, v]) => {
      if (typeof v === "string") sanitized[k] = v;
    });
    return sanitized;
  };

  const applySetCookie = (setCookie: unknown) => {
    const sanitized = sanitizeCookie(setCookie);
    if (!sanitized) return;
    clientCookie.value = sanitized;
  };

  const createHeaders = (isClientSender: boolean, cid?: string): SocketHeaders => {
    const timestamp = Date.now();
    const headers: SocketHeaders = { timestamp };
    if (cid) headers.cid = cid;
    if (isClientSender && Object.keys(clientCookie.value).length > 0) {
      headers.cookie = clientCookie.value;
    }
    return headers;
  };

  /** Serialize a payload to socket packet and deliver to one/all active sockets. */
  const send = (payload: SocketPacketPayload, ws?: WS) => {
    const packet: SocketPacket = { "sock.et": SOCKET_MAGIC_NUMBER, ...payload };
    const data = JSON.stringify(packet);
    if (ws) ws.send(data);
    else if (clientWS.ws?.readyState === 1) clientWS.ws.send(data);
    else serverWS.ws.forEach((s) => s.readyState === 1 && s.send(data));
  };

  const setupPush = (events: string[], _bus: Bus, reverseBus: Bus, isClient: boolean) => {
    const api: {
      push: Record<string, (...data: unknown[]) => void>;
      handle: Record<
        string,
        (handler: (c: SocketPushHandlerContext<unknown>) => void) => () => void
      >;
    } = {
      push: {},
      handle: {},
    };
    events.forEach((event) => {
      api.push[event] = (data: unknown) => {
        const body = { value: data };
        send({
          method: "PUSH",
          event,
          body,
          headers: createHeaders(isClient),
        });
      };
      api.handle[event] = (handler: (c: SocketPushHandlerContext<unknown>) => void) =>
        reverseBus.on(event, (e) =>
          handler({
            push: Object.freeze({
              method: "PUSH" as const,
              event,
              body: e.body.value,
              headers: Object.freeze({ ...e.headers }),
            }),
          }),
        );
    });
    return api;
  };

  const setupReq = (
    events: string[],
    reqBus: Bus,
    resBus: Bus,
    errBus: Bus,
    timeout: number,
    isClient: boolean,
  ) => {
    /**
     * Request lane model:
     * 1) `request(...)` sends packet over WS and waits on `resBus`.
     * 2) Remote `onMessage(...)` parses `RESPONSE`/`ERROR` packets and dispatches into `resBus`/`errBus`.
     * 3) Waiters map packet method to result:
     *    - RESPONSE -> `{ type: "Success", value }`
     *    - ERROR -> `{ type: "Failure", error }`
     *
     * `reqBus` is consumed only by `handle(...)` and fed by incoming `REQUEST` packets
     * from `onMessage(...)`.
     */
    const api: {
      request: Record<
        string,
        (...args: Arg<unknown, RequestOption>) => Promise<unknown> | Promise<unknown>[]
      >;
      handle: Record<string, (handler: SocketReqMiddleware<unknown, unknown>) => () => void>;
      use: (
        matcher: SocketRequestMatcher,
        handler: SocketReqMiddleware<unknown, unknown>,
      ) => () => void;
    } = { request: {}, handle: {}, use: () => () => undefined };
    const middlewareMap: Record<string, SocketReqMiddleware<unknown, unknown>[]> = {};

    const toPredicate = (
      matcher: SocketRequestMatcher,
    ): ((c: SocketReqHandlerContext<unknown>) => boolean | Promise<boolean>) => {
      if (typeof matcher === "string") return (c) => c.req.event === matcher;
      if (Array.isArray(matcher)) return (c) => matcher.includes(c.req.event);
      if (matcher instanceof RegExp) return (c) => matcher.test(c.req.event);
      return matcher;
    };

    events.forEach((event) => {
      middlewareMap[event] = [];
      api.request[event] = (...args) => {
        const data = args[0],
          cid = createUid(),
          t = args[1]?.timeout ?? timeout;

        const exec = (ws?: WS): Promise<SocketResponse<unknown>> =>
          new Promise((resolve, reject) => {
            let timer: ReturnType<typeof setTimeout>;
            const clean = () => {
              clearTimeout(timer);
              off();
              offErr();
            };
            // Match by cid (+ ws on server broadcast mode) to resolve only the target response.
            const off = resBus.on(event, (e) => {
              if (e.headers.cid === cid && (!ws || e.context.ws === ws)) {
                clean();
                resolve({ type: "Success", value: e.body.value });
              }
            });
            const offErr = errBus.on(event, (e) => {
              if (e.headers.cid === cid && (!ws || e.context.ws === ws)) {
                clean();
                resolve({ type: "Failure", error: e.body.value });
              }
            });
            timer = setTimeout(() => {
              clean();
              reject(new SocketError(SocketError.RequestTimeout));
            }, t);
            const body = { value: data };
            const headers = createHeaders(isClient, cid);
            if (!isClient || clientWS.ws?.readyState === 1) {
              send(
                {
                  method: "REQUEST",
                  event,
                  body,
                  headers,
                },
                ws,
              );
            } else {
              clean();
              reject(new SocketError(SocketError.ConnectionClosed));
            }
          });
        return isClient ? exec() : Array.from(serverWS.ws).map(exec);
      };
      reqBus.on(event, async (e) => {
        const c: SocketReqHandlerContext<unknown> = {
          req: Object.freeze({
            method: "REQUEST" as const,
            event,
            body: e.body.value,
            headers: Object.freeze({ ...e.headers }),
          }),
          res: { method: "RESPONSE", event, header: {} },
        };
        const middlewares = middlewareMap[event] ?? [];
        if (middlewares.length === 0) return;
        try {
          // Tracks the latest middleware index that has started execution.
          // Used to prevent calling next() multiple times from the same middleware.
          let i = -1;
          const dispatch = async (idx: number): Promise<void> => {
            // next() must move forward exactly once.
            if (idx <= i) throw new Error("next() called multiple times");
            i = idx;
            const middleware = middlewares[idx];
            // End of middleware chain.
            if (!middleware) return;
            // Middleware can either:
            // 1) return a response body directly, or
            // 2) mutate c.res.body and/or await next() for downstream processing.
            const result = await middleware(c, () => dispatch(idx + 1));
            if (result !== undefined) c.res.body = result;
          };
          // Start middleware chain at index 0.
          await dispatch(0);
          if (c.res.body === undefined) return;
          const headers = { ...c.res.header, ...createHeaders(!isClient, e.headers.cid) };
          send(
            {
              method: "RESPONSE",
              event,
              body: { value: c.res.body },
              headers,
            },
            e.context.ws,
          );
        } catch (error) {
          const headers = { ...c.res.header, ...createHeaders(!isClient, e.headers.cid) };
          send(
            {
              method: "ERROR",
              event,
              body: { value: error },
              headers,
            },
            e.context.ws,
          );
        }
      });
      api.handle[event] = (handler: SocketReqMiddleware<unknown, unknown>) => {
        const middlewares = middlewareMap[event];
        if (!middlewares) return () => undefined;
        middlewares.push(handler);
        return () => {
          // Unsubscribe this middleware from the event pipeline.
          const idx = middlewares.indexOf(handler);
          if (idx >= 0) middlewares.splice(idx, 1);
        };
      };
    });

    api.use = (matcher: SocketRequestMatcher, handler: SocketReqMiddleware<unknown, unknown>) => {
      const predicate = toPredicate(matcher);
      const offs = events.map((event) => {
        const register = api.handle[event];
        if (!register) return () => undefined;
        return register(async (c, next) => {
          if (!(await predicate(c))) return next();
          return handler(c, next);
        });
      });
      return () => {
        offs.forEach((off) => off());
      };
    };
    return api;
  };

  const validate = async (
    schema: StandardSchema | undefined,
    data: unknown,
    name: string,
    type: string,
  ) => {
    if (!schema) throw new Error(`No schema for ${type} [${name}]`);
    const res = await schema["~standard"].validate(data);
    if ("issues" in res) {
      console.error(`Validation failed for ${type} [${name}]`, res.issues);
      return { success: false as const, error: res.issues };
    }
    return { success: true as const, value: res.value };
  };

  const onMessage = (isClient: boolean) => async (e: MessageEvent, ws_?: WS) => {
    try {
      const p = JSON.parse(e.data);
      if (p["sock.et"] !== SOCKET_MAGIC_NUMBER) return;
      // Client-only cookie mutation sent by server.
      if (isClient) applySetCookie(p.headers?.["set-cookie"]);
      const {
        method,
        event,
        body: { value },
      } = p;
      const headers = (p.headers ?? {}) as SocketHeaders;
      const cookie = sanitizeCookie(headers.cookie);
      if (cookie) headers.cookie = cookie;
      else delete headers.cookie;
      const setCookie = sanitizeCookie(headers["set-cookie"]);
      if (setCookie) headers["set-cookie"] = setCookie;
      else delete headers["set-cookie"];
      if ((method === "REQUEST" || method === "RESPONSE" || method === "ERROR") && !headers.cid)
        return;
      const ws = isClient ? undefined : ws_;
      const body = { value };
      const context = { ws };

      /**
       * Incoming routing rule:
       * - PUSH -> opposite-side push bus
       * - REQUEST -> opposite-side request bus (consumed by `setupReq.handle`)
       * - RESPONSE -> opposite-side response bus (consumed by `setupReq.request` waiters)
       * - ERROR -> opposite-side error bus (consumed by `setupReq.request` waiters)
       *
       * "Opposite-side" means:
       * - when parsing on client, dispatch to server-side buses (`s*`)
       * - when parsing on server, dispatch to client-side buses (`c*`)
       */
      if (method === "PUSH") {
        const res = await validate(
          (isClient ? schemas.serverPushes : schemas.clientPushes)?.[event],
          value,
          event,
          "push",
        );
        if (res.success)
          (isClient ? buses.sPush : buses.cPush).dispatchEvent(
            new SocketEvent(event, { value: res.value }, headers, context),
          );
      } else if (method === "REQUEST") {
        const res = await validate(
          (isClient ? schemas.serverRequests : schemas.clientRequests)?.[event]?.[0],
          value,
          event,
          "req",
        );
        if (res.success) {
          (isClient ? buses.sReq : buses.cReq).dispatchEvent(
            new SocketEvent(event, { value: res.value }, headers, context),
          );
        } else {
          send({
            method: "ERROR",
            event,
            body: { value: res.error },
            headers: createHeaders(!isClient, headers.cid),
          });
        }
      } else if (method === "RESPONSE") {
        const res = await validate(
          (isClient ? schemas.clientRequests : schemas.serverRequests)?.[event]?.[1],
          value,
          event,
          "res",
        );
        if (res.success)
          (isClient ? buses.sRes : buses.cRes).dispatchEvent(
            new SocketEvent(event, { value: res.value }, headers, context),
          );
      } else if (method === "ERROR") {
        (isClient ? buses.sErr : buses.cErr).dispatchEvent(
          new SocketEvent(event, body, headers, context),
        );
      }
    } catch {}
  };

  const cPushApi = setupPush(
    Object.keys(schemas.clientPushes ?? {}),
    buses.sPush,
    buses.cPush,
    true,
  );
  const sPushApi = setupPush(
    Object.keys(schemas.serverPushes ?? {}),
    buses.cPush,
    buses.sPush,
    false,
  );
  const cReqApi = setupReq(
    Object.keys(schemas.clientRequests ?? {}),
    buses.cReq,
    buses.sRes,
    buses.sErr,
    options?.clientTimeout ?? DEFAULT_TIMEOUT,
    true,
  );
  const sReqApi = setupReq(
    Object.keys(schemas.serverRequests ?? {}),
    buses.sReq,
    buses.cRes,
    buses.cErr,
    options?.serverTimeout ?? DEFAULT_TIMEOUT,
    false,
  );

  type ClientApi = {
    push: { [K in keyof CPush]: (...data: Arg<CPush[K]["push"]>) => void };
    request: {
      [K in keyof CReq]: (
        ...data: Arg<CReq[K]["req"], RequestOption>
      ) => Promise<SocketResponse<CReq[K]["res"]>>;
    };
    onPush: {
      [K in keyof SPush]: (handler: SocketPushHandler<SPush[K]["push"]>) => () => void;
    };
    onRequest: {
      [K in keyof SReq]: (
        handler: SocketReqMiddleware<SReq[K]["req"], SReq[K]["res"]>,
      ) => () => void;
    };
    useRequest: (
      matcher: SocketRequestMatcher,
      handler: SocketReqMiddleware<unknown, unknown>,
    ) => () => void;
  };
  type ServerApi = {
    push: { [K in keyof SPush]: (...data: Arg<SPush[K]["push"]>) => void };
    request: {
      [K in keyof SReq]: (
        ...data: Arg<SReq[K]["req"], RequestOption>
      ) => Promise<SocketResponse<SReq[K]["res"]>>[];
    };
    onPush: {
      [K in keyof CPush]: (handler: SocketPushHandler<CPush[K]["push"]>) => () => void;
    };
    onRequest: {
      [K in keyof CReq]: (
        handler: SocketReqMiddleware<CReq[K]["req"], CReq[K]["res"]>,
      ) => () => void;
    };
    useRequest: (
      matcher: SocketRequestMatcher,
      handler: SocketReqMiddleware<unknown, unknown>,
    ) => () => void;
  };

  return {
    client: {
      onMessage: onMessage(true),
      bindWS: (ws: WS) => (clientWS.ws = ws),
      api: {
        push: cPushApi.push,
        request: cReqApi.request,
        onPush: sPushApi.handle,
        onRequest: sReqApi.handle,
        useRequest: sReqApi.use,
      } as ClientApi,
    },
    server: {
      onMessage: onMessage(false),
      addWS: (ws: WS) => serverWS.ws.add(ws),
      removeWS: (ws: WS) => serverWS.ws.delete(ws),
      api: {
        push: sPushApi.push,
        request: sReqApi.request,
        onPush: cPushApi.handle,
        onRequest: cReqApi.handle,
        useRequest: cReqApi.use,
      } as ServerApi,
    },
  };
}

export {
  type StandardSchema,
  SocketError,
  type SocketResponse,
  type SocketHeaders,
  type SocketPushHandlerContext,
  type SocketReqHandlerContext,
  type SocketNext,
  type SocketPushHandler,
  type SocketReqMiddleware,
  type SocketRequestMatcher,
  type SocketBody,
  type SocketPacket,
  type WS,
  type SocketSchemas,
  defineSocketSchema,
  createSocket,
};

export function createClientSocket<T extends SocketSchemas>(
  s: T,
  o?: RequestOption & { uid?: () => string },
) {
  return createSocket(s, { clientTimeout: o?.timeout, uid: o?.uid }).client;
}
export function createServerSocket<T extends SocketSchemas>(
  s: T,
  o?: RequestOption & { uid?: () => string },
) {
  return createSocket(s, { serverTimeout: o?.timeout, uid: o?.uid }).server;
}
