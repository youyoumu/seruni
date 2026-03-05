import { type StandardSchemaV1 } from "@standard-schema/spec";

type StandardSchema = StandardSchemaV1;
type Infer<T extends StandardSchema> = StandardSchemaV1.InferOutput<T>;
type InferReqRes<T extends StandardSchema | undefined> = T extends StandardSchema
  ? StandardSchemaV1.InferOutput<T>
  : undefined;
type InferErr<T extends StandardSchema | undefined> = T extends StandardSchema
  ? StandardSchemaV1.InferOutput<T>
  : undefined;
type ReqSchemaTuple = [
  (StandardSchema | undefined)?,
  (StandardSchema | undefined)?,
  (StandardSchema | undefined)?,
];
type Arg<T1, T2 = undefined> = undefined extends T1
  ? undefined extends T2
    ? [arg1?: T1, arg2?: T2]
    : [arg1: T1 | undefined, arg2: T2]
  : undefined extends T2
    ? [arg1: T1, arg2?: T2]
    : [arg1: T1, arg2: T2];

const uid = () => Math.random().toString(36).slice(2);

type SocketErr =
  | typeof SocketError.ConnectionClosed
  | typeof SocketError.RequestTimeout
  | typeof SocketError.InvalidResponse;
class SocketError extends Error {
  static ConnectionClosed = "ConnectionClosed" as const;
  static RequestTimeout = "RequestTimeout" as const;
  static InvalidResponse = "InvalidResponse" as const;
  constructor(public readonly type: SocketErr) {
    super();
    this.name = "SocketError";
  }
}
class SocketFailure {
  constructor(
    public readonly error: unknown,
    public readonly headers?: SocketHeaders,
  ) {}
}
type SocketResponse<T = unknown, E = unknown> =
  | { type: "Success"; value: T }
  | { type: "Failure"; error: E };

interface SocketBody<T = unknown> {
  value?: T;
}

const SOCKET_MAGIC_NUMBER = 16777619;
const DEFAULT_TIMEOUT = 300000;
/**
 * Wire-level packet exchanged between client and server.
 * - `method`: packet intent
 * - `event`: schema key/event name
 * - `body`: validated payload container
 * - `headers`: protocol metadata (correlation/cookie/timestamp)
 */
interface SocketPacket {
  "sock.et": typeof SOCKET_MAGIC_NUMBER;
  method: "PUSH" | "REQ" | "RES" | "ERR";
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
interface SocketReqHandlerContext<TBody = unknown, TErr = unknown> {
  req: Readonly<{
    method: "REQ";
    event: string;
    body: TBody;
    headers: Readonly<SocketHeaders>;
  }>;
  res: {
    method: "RES" | "ERR";
    event: string;
    header: SocketHeaders;
    body?: unknown;
  };
  fail: (error: TErr, headers?: SocketHeaders) => never;
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
type SocketReqMiddleware<TReq = unknown, TRes = unknown, TErr = unknown> = (
  c: SocketReqHandlerContext<TReq, TErr>,
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
  invalidResponse?: true;
}

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

class ET extends EventTarget {
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
type ReqSchemas<T extends Record<string, ReqSchemaTuple>> = {
  [K in keyof T]: { req: InferReqRes<T[K][0]>; res: InferReqRes<T[K][1]>; err: InferErr<T[K][2]> };
};
interface SocketSchemas {
  clientPushes: Record<string, StandardSchema>;
  serverPushes: Record<string, StandardSchema>;
  clientRequests: Record<string, ReqSchemaTuple>;
  serverRequests: Record<string, ReqSchemaTuple>;
}

type RequestOption = { timeout?: number } | undefined;
type SocketErrorHandlerContext = {
  req: Readonly<{
    method: "REQ";
    event: string;
    headers: Readonly<SocketHeaders>;
  }>;
  res: Readonly<{
    method: "ERR";
    event: string;
    header: SocketHeaders;
  }>;
  error: unknown;
};
type SocketErrorHandlerResult = { error: unknown; headers?: SocketHeaders } | void;
type SocketErrorHandler = (
  ctx: SocketErrorHandlerContext,
) => SocketErrorHandlerResult | Promise<SocketErrorHandlerResult>;

function defineSocketSchema<T extends SocketSchemas>(schema: T) {
  return schema;
}

class SocketCore<const Schema extends SocketSchemas> {
  #schemas: Schema;
  #clientCookie = { value: {} as Record<string, string> };
  #uid: () => string;
  #onError?: SocketErrorHandler;
  readonly clientWS: { ws: WS | undefined } = { ws: undefined };
  readonly serverWS = { ws: new Set<WS>() };
  readonly ets = {
    cPush: new ET(),
    sPush: new ET(),
    cReq: new ET(),
    sReq: new ET(),
    cRes: new ET(),
    sRes: new ET(),
    cErr: new ET(),
    sErr: new ET(),
  };
  readonly clientTimeout: number;
  readonly serverTimeout: number;

  constructor(
    schemas: Schema,
    options?: {
      clientTimeout?: number;
      serverTimeout?: number;
      uid?: () => string;
      onError?: SocketErrorHandler;
    },
  ) {
    this.#schemas = schemas;
    this.#uid = options?.uid ?? uid;
    this.#onError = options?.onError;
    this.clientTimeout = options?.clientTimeout ?? DEFAULT_TIMEOUT;
    this.serverTimeout = options?.serverTimeout ?? DEFAULT_TIMEOUT;
  }

  #sanitizeCookie(cookie: unknown): Record<string, string> | undefined {
    if (!cookie || typeof cookie !== "object" || Array.isArray(cookie)) return undefined;
    const sanitized: Record<string, string> = {};
    Object.entries(cookie).forEach(([k, v]) => {
      if (typeof v === "string") sanitized[k] = v;
    });
    return sanitized;
  }

  async #validate(schema: StandardSchema | undefined, data: unknown, event: string, type: string) {
    if (!schema) {
      if (data === undefined) return { success: true as const, value: undefined };
      return {
        success: false as const,
        error: [`Validation failed for ${type} [${event}]: expected undefined`],
      };
    }
    const res = await schema["~standard"].validate(data);
    if ("issues" in res) {
      console.error(`Validation failed for ${type} [${event}]`, res.issues);
      return { success: false as const, error: res.issues };
    }
    return { success: true as const, value: res.value };
  }

  #applySetCookie(setCookie: unknown) {
    const sanitized = this.#sanitizeCookie(setCookie);
    if (!sanitized) return;
    this.#clientCookie.value = sanitized;
  }

  #createHeaders(isClientSender: boolean, cid?: string): SocketHeaders {
    const headers: SocketHeaders = { timestamp: Date.now() };
    if (cid) headers.cid = cid;
    if (isClientSender && Object.keys(this.#clientCookie.value).length > 0) {
      headers.cookie = this.#clientCookie.value;
    }
    return headers;
  }

  #send(payload: SocketPacketPayload, ws?: WS) {
    const packet: SocketPacket = { ...payload, "sock.et": SOCKET_MAGIC_NUMBER };
    const data = JSON.stringify(packet);
    if (ws) ws.send(data);
    else if (this.clientWS.ws?.readyState === 1) this.clientWS.ws.send(data);
    else this.serverWS.ws.forEach((s) => s.readyState === 1 && s.send(data));
  }

  createPushLane(events: string[], reverseET: ET, isClient: boolean) {
    const api: {
      push: Record<string, (...data: unknown[]) => void>;
      handle: Record<
        string,
        (handler: (c: SocketPushHandlerContext<unknown>) => void) => () => void
      >;
    } = { push: {}, handle: {} };
    events.forEach((event) => {
      api.push[event] = (data: unknown) => {
        this.#send({
          method: "PUSH",
          event,
          body: { value: data },
          headers: this.#createHeaders(isClient),
        });
      };
      api.handle[event] = (handler: (c: SocketPushHandlerContext<unknown>) => void) =>
        reverseET.on(event, (e) =>
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
  }

  createReqLane(
    events: string[],
    reqET: ET,
    resET: ET,
    errET: ET,
    timeout: number,
    isClient: boolean,
  ) {
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
        const data = args[0];
        const cid = this.#uid();
        const t = args[1]?.timeout ?? timeout;
        const exec = (ws?: WS): Promise<SocketResponse<unknown>> =>
          new Promise((resolve, reject) => {
            let timer: ReturnType<typeof setTimeout>;
            const clean = () => {
              clearTimeout(timer);
              off();
              offErr();
            };
            const off = resET.on(event, (e) => {
              if (e.headers.cid === cid && (!ws || e.context.ws === ws)) {
                clean();
                resolve({ type: "Success", value: e.body.value });
              }
            });
            const offErr = errET.on(event, async (e) => {
              if (e.headers.cid === cid && (!ws || e.context.ws === ws)) {
                clean();
                if (e.context.invalidResponse) {
                  reject(new SocketError(SocketError.InvalidResponse));
                  return;
                }
                resolve({ type: "Failure", error: e.body.value });
              }
            });
            timer = setTimeout(() => {
              clean();
              reject(new SocketError(SocketError.RequestTimeout));
            }, t);
            const headers = this.#createHeaders(isClient, cid);
            if (!isClient || this.clientWS.ws?.readyState === 1) {
              this.#send({ method: "REQ", event, body: { value: data }, headers }, ws);
            } else {
              clean();
              reject(new SocketError(SocketError.ConnectionClosed));
            }
          });
        return isClient ? exec() : Array.from(this.serverWS.ws).map(exec);
      };

      reqET.on(event, async (e) => {
        const fail = (error: unknown, headers?: SocketHeaders): never => {
          throw new SocketFailure(error, headers);
        };
        const res: SocketReqHandlerContext<unknown>["res"] = {
          method: "RES",
          event,
          header: {},
        };
        Object.defineProperty(res, "method", {
          value: "RES",
          writable: false,
          enumerable: true,
          configurable: false,
        });
        Object.defineProperty(res, "event", {
          value: event,
          writable: false,
          enumerable: true,
          configurable: false,
        });
        const c: SocketReqHandlerContext<unknown> = {
          req: Object.freeze({
            method: "REQ" as const,
            event,
            body: e.body.value,
            headers: Object.freeze({ ...e.headers }),
          }),
          res,
          fail,
        };
        const middlewares = middlewareMap[event] ?? [];
        if (middlewares.length === 0) return;
        try {
          let i = -1;
          const dispatch = async (idx: number): Promise<void> => {
            if (idx <= i) throw new Error("next() called multiple times");
            i = idx;
            const middleware = middlewares[idx];
            if (!middleware) return;
            const result = await middleware(c, () => dispatch(idx + 1));
            if (result !== undefined) c.res.body = result;
          };
          await dispatch(0);
          if (c.res.body === undefined) return;
          const headers = { ...c.res.header, ...this.#createHeaders(!isClient, e.headers.cid) };
          this.#send(
            { method: c.res.method, event, body: { value: c.res.body }, headers },
            e.context.ws,
          );
        } catch (error) {
          const isSocketFailure = error instanceof SocketFailure;
          let failure: SocketFailure;
          if (isSocketFailure) {
            failure = error;
          } else if (this.#onError) {
            try {
              const handled = await this.#onError({
                error,
                req: c.req,
                res: Object.freeze({
                  method: "ERR" as const,
                  event: c.res.event,
                  header: c.res.header,
                }),
              });
              failure =
                handled && "error" in handled
                  ? new SocketFailure(handled.error, handled.headers)
                  : new SocketFailure("InternalError");
            } catch {
              failure = new SocketFailure("InternalError");
            }
          } else {
            failure = new SocketFailure("InternalError");
          }
          const errSchema = (
            isClient ? this.#schemas.clientRequests : this.#schemas.serverRequests
          )?.[event]?.[2];
          if (isSocketFailure) {
            const errValidation = await this.#validate(errSchema, failure.error, event, "err");
            if (!errValidation.success) failure = new SocketFailure("InternalError");
          }
          const headers = {
            ...c.res.header,
            ...failure.headers,
            ...this.#createHeaders(!isClient, e.headers.cid),
          };
          this.#send(
            { method: "ERR", event: c.res.event, body: { value: failure.error }, headers },
            e.context.ws,
          );
        }
      });

      api.handle[event] = (handler: SocketReqMiddleware<unknown, unknown>) => {
        const middlewares = middlewareMap[event];
        if (!middlewares) return () => undefined;
        middlewares.push(handler);
        return () => {
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
      return () => offs.forEach((off) => off());
    };

    return api;
  }

  createOnMessage(isClient: boolean) {
    return async (e: MessageEvent, ws_?: WS) => {
      try {
        const p = JSON.parse(e.data);
        if (p["sock.et"] !== SOCKET_MAGIC_NUMBER) return;
        if (isClient) this.#applySetCookie(p.headers?.["set-cookie"]);
        const {
          method,
          event,
          body: { value },
        } = p;
        const headers = (p.headers ?? {}) as SocketHeaders;
        const cookie = this.#sanitizeCookie(headers.cookie);
        if (cookie) headers.cookie = cookie;
        else delete headers.cookie;
        const setCookie = this.#sanitizeCookie(headers["set-cookie"]);
        if (setCookie) headers["set-cookie"] = setCookie;
        else delete headers["set-cookie"];
        if ((method === "REQ" || method === "RES" || method === "ERR") && !headers.cid) return;
        const context = { ws: isClient ? undefined : ws_ };
        const body = { value };

        if (method === "PUSH") {
          const res = await this.#validate(
            (isClient ? this.#schemas.serverPushes : this.#schemas.clientPushes)?.[event],
            value,
            event,
            "push",
          );
          if (res.success) {
            (isClient ? this.ets.sPush : this.ets.cPush).dispatchEvent(
              new SocketEvent(event, { value: res.value }, headers, context),
            );
          }
        } else if (method === "REQ") {
          const res = await this.#validate(
            (isClient ? this.#schemas.serverRequests : this.#schemas.clientRequests)?.[event]?.[0],
            value,
            event,
            "req",
          );
          if (res.success) {
            (isClient ? this.ets.sReq : this.ets.cReq).dispatchEvent(
              new SocketEvent(event, { value: res.value }, headers, context),
            );
          } else {
            this.#send({
              method: "ERR",
              event,
              body: { value: res.error },
              headers: this.#createHeaders(!isClient, headers.cid),
            });
          }
        } else if (method === "RES") {
          const res = await this.#validate(
            (isClient ? this.#schemas.clientRequests : this.#schemas.serverRequests)?.[event]?.[1],
            value,
            event,
            "res",
          );
          if (res.success) {
            (isClient ? this.ets.sRes : this.ets.cRes).dispatchEvent(
              new SocketEvent(event, { value: res.value }, headers, context),
            );
          }
        } else if (method === "ERR") {
          const res = await this.#validate(
            (isClient ? this.#schemas.clientRequests : this.#schemas.serverRequests)?.[event]?.[2],
            value,
            event,
            "err",
          );
          if (res.success) {
            (isClient ? this.ets.sErr : this.ets.cErr).dispatchEvent(
              new SocketEvent(event, { value: res.value }, headers, context),
            );
          } else {
            (isClient ? this.ets.sErr : this.ets.cErr).dispatchEvent(
              new SocketEvent(event, body, headers, { ...context, invalidResponse: true }),
            );
          }
        }
      } catch {}
    };
  }
}

function createSocket<const Schema extends SocketSchemas>(
  schemas: Schema,
  options?: {
    clientTimeout?: number;
    serverTimeout?: number;
    uid?: () => string;
    onError?: SocketErrorHandler;
  },
) {
  type CPush = PushSchemas<NonNullable<Schema["clientPushes"]>>;
  type SPush = PushSchemas<NonNullable<Schema["serverPushes"]>>;
  type CReq = ReqSchemas<NonNullable<Schema["clientRequests"]>>;
  type SReq = ReqSchemas<NonNullable<Schema["serverRequests"]>>;

  const core = new SocketCore(schemas, options);

  const cPushApi = core.createPushLane(
    Object.keys(schemas.clientPushes ?? {}),
    core.ets.cPush,
    true,
  );
  const sPushApi = core.createPushLane(
    Object.keys(schemas.serverPushes ?? {}),
    core.ets.sPush,
    false,
  );
  const cReqApi = core.createReqLane(
    Object.keys(schemas.clientRequests ?? {}),
    core.ets.cReq,
    core.ets.sRes,
    core.ets.sErr,
    core.clientTimeout,
    true,
  );
  const sReqApi = core.createReqLane(
    Object.keys(schemas.serverRequests ?? {}),
    core.ets.sReq,
    core.ets.cRes,
    core.ets.cErr,
    core.serverTimeout,
    false,
  );
  const clientOnMessage = core.createOnMessage(true);
  const serverOnMessage = core.createOnMessage(false);

  type ClientApi = {
    push: { [K in keyof CPush]: (...data: Arg<CPush[K]["push"]>) => void };
    request: {
      [K in keyof CReq]: (
        ...data: Arg<CReq[K]["req"], RequestOption>
      ) => Promise<SocketResponse<CReq[K]["res"], CReq[K]["err"]>>;
    };
    onPush: {
      [K in keyof SPush]: (handler: SocketPushHandler<SPush[K]["push"]>) => () => void;
    };
    onRequest: {
      [K in keyof SReq]: (
        handler: SocketReqMiddleware<SReq[K]["req"], SReq[K]["res"], SReq[K]["err"]>,
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
      ) => Promise<SocketResponse<SReq[K]["res"], SReq[K]["err"]>>[];
    };
    onPush: {
      [K in keyof CPush]: (handler: SocketPushHandler<CPush[K]["push"]>) => () => void;
    };
    onRequest: {
      [K in keyof CReq]: (
        handler: SocketReqMiddleware<CReq[K]["req"], CReq[K]["res"], CReq[K]["err"]>,
      ) => () => void;
    };
    useRequest: (
      matcher: SocketRequestMatcher,
      handler: SocketReqMiddleware<unknown, unknown>,
    ) => () => void;
  };

  return {
    client: {
      onMessage: clientOnMessage,
      bindWS: (ws: WS) => (core.clientWS.ws = ws),
      api: {
        push: cPushApi.push,
        request: cReqApi.request,
        onPush: sPushApi.handle,
        onRequest: sReqApi.handle,
        useRequest: sReqApi.use,
      } as ClientApi,
    },
    server: {
      onMessage: serverOnMessage,
      addWS: (ws: WS) => core.serverWS.ws.add(ws),
      removeWS: (ws: WS) => core.serverWS.ws.delete(ws),
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

type ClientRuntime<T extends SocketSchemas> = ReturnType<typeof createSocket<T>>["client"];
type ServerRuntime<T extends SocketSchemas> = ReturnType<typeof createSocket<T>>["server"];

class ClientSocket<T extends SocketSchemas> {
  #socket: ClientRuntime<T>;
  constructor(s: T, o?: RequestOption & { uid?: () => string; onError?: SocketErrorHandler }) {
    this.#socket = createSocket(s, {
      clientTimeout: o?.timeout,
      uid: o?.uid,
      onError: o?.onError,
    }).client;
  }
  get api() {
    return this.#socket.api;
  }
  onMessage = (e: MessageEvent) => this.#socket.onMessage(e);
  bindWS = (ws: WS) => this.#socket.bindWS(ws);
}

class ServerSocket<T extends SocketSchemas> {
  #socket: ServerRuntime<T>;
  constructor(s: T, o?: RequestOption & { uid?: () => string; onError?: SocketErrorHandler }) {
    this.#socket = createSocket(s, {
      serverTimeout: o?.timeout,
      uid: o?.uid,
      onError: o?.onError,
    }).server;
  }
  get api() {
    return this.#socket.api;
  }
  onMessage = (e: MessageEvent, ws?: WS) => this.#socket.onMessage(e, ws);
  addWS = (ws: WS) => this.#socket.addWS(ws);
  removeWS = (ws: WS) => this.#socket.removeWS(ws);
}

export {
  type StandardSchema,
  SocketError,
  SocketFailure,
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
  type SocketErrorHandler,
  type SocketErrorHandlerContext,
  type SocketErrorHandlerResult,
  defineSocketSchema,
  ClientSocket,
  ServerSocket,
};
